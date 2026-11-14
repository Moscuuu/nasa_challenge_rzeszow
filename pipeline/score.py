"""Score every Earth Cell of permafrost against the 7 Mars Base Candidate Sites (Depth Layer 0-1 m).

Temperature (Rank Comparison, closest to the Mars value = best), for daily min, max and amplitude:
    s_q = 1 - rank(|E_q - M_q|) / (n - 1);  temperature = mean over q
Ground ice (position match):
    ice = 1 - |percentile_Earth(shallow_ice) - percentile_Mars(SWIM C 0-1 m)|
Overall = mean of available features (equal weights, missing data skipped).

Output: data/interim/scores_0-1m.npz

Usage: python -I pipeline/score.py data/interim
"""
import json
import sys
from pathlib import Path

import numpy as np

LAYER = "0-1m"
TEMP_QUANTITIES = ("tmin", "tmax", "amp")


def rank01(values: np.ndarray) -> np.ndarray:
    """Fraction of other values strictly below each value (ties share the lowest rank), NaN kept."""
    out = np.full(values.shape, np.nan)
    ok = np.isfinite(values)
    v = values[ok]
    order = np.sort(v)
    out[ok] = np.searchsorted(order, v, side="left") / max(v.size - 1, 1)
    return out


def main(interim: Path) -> None:
    grid = np.load(interim / "earth_grid.npz")
    era5 = np.load(interim / "era5_skin_2023.npz")
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))

    mask = grid["permafrost"]
    rows, cols = np.nonzero(mask)
    n = rows.size
    earth_t = {q: era5[q][rows, cols].astype(np.float64) for q in TEMP_QUANTITIES}
    ice_e = grid["shallow_ice"][rows, cols].astype(np.float64)
    ice_e_pct = rank01(ice_e)

    n_sites = len(sites)
    temp_parts = np.full((n_sites, len(TEMP_QUANTITIES), n), np.nan)
    ice = np.full((n_sites, n), np.nan)
    for i, s in enumerate(sites):
        for j, q in enumerate(TEMP_QUANTITIES):
            d = np.abs(earth_t[q] - s["temperature"][q])
            temp_parts[i, j] = 1.0 - rank01(d)
        ice[i] = 1.0 - np.abs(ice_e_pct - s["ice"][LAYER]["percentile"])
    with np.errstate(invalid="ignore"):
        temperature = np.nanmean(temp_parts, axis=1) if np.isfinite(temp_parts).any() else temp_parts[:, 0]
    feats = np.stack([temperature, ice])  # (feature, site, cell)
    with np.errstate(invalid="ignore"):
        overall = np.nanmean(feats, axis=0)
    best_site = np.nanargmax(np.nan_to_num(overall, nan=-1), axis=0)
    best = overall[best_site, np.arange(n)]
    pct = rank01(best)
    order = np.argsort(-best, kind="stable")
    rank = np.empty(n, dtype=np.int64)
    rank[order] = np.arange(1, n + 1)

    out = interim / f"scores_{LAYER}.npz"
    np.savez_compressed(
        out, rows=rows, cols=cols, site_ids=np.array([s["id"] for s in sites]),
        temp_parts=temp_parts.astype(np.float32), temperature=temperature.astype(np.float32),
        ice=ice.astype(np.float32), overall=overall.astype(np.float32),
        best_site=best_site, best=best.astype(np.float32), percentile=pct.astype(np.float32), rank=rank,
        earth_tmin=earth_t["tmin"], earth_tmax=earth_t["tmax"], earth_amp=earth_t["amp"],
        shallow_ice=ice_e, alt=grid["alt"][rows, cols], pfr=grid["pfr"][rows, cols],
    )
    print("cells", n, "with temperature", int(np.isfinite(earth_t["tmin"]).sum()))
    for i, s in enumerate(sites):
        print(f"{s['id']:22s} best-for {int((best_site == i).sum()):6d} cells, max score {np.nanmax(overall[i]):.3f}")
    print("saved", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
