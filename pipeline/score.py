"""Score every Earth Cell of permafrost against the 7 Mars Base Candidate Sites, for one Depth Layer.

Temperature (Rank Comparison, closest to the Mars value = best), per quantity q:
    s_q = 1 - rank(|E_q - M_q|) / (n - 1);  temperature = mean over q
  0-1 m (active layer): daily min / max / amplitude of surface temperature, whole year AND local summer
  1-5 m:  annual-mean ground temperature, mean of 2 m and 5 m
  > 5 m:  annual-mean ground temperature at 10 m (Mars: deepest model layer)
Ground ice (position match, mid-rank percentiles on each planet):
    ice = 1 - |percentile_Earth - percentile_Mars(SWIM C of the layer, among C > 0)|
Thermal-contraction polygons (position match, 0-1 m and 1-5 m only; not relevant below 5 m):
    polygons = 1 - |percentile_Earth(cracking potential from GST) - percentile_Mars(SWIM polygon share)|
Dryness (0-1 m only; separates dry permafrost from wet tundra), Rank Comparison toward Mars (~0 water):
    s_q = 1 - rank(E_q), q = local-summer surface soil wetness (NASA SMAP L4) and annual precipitation
    (ERA5-Land); dryness = mean over the q that have data. SMAP L4 has no data on permanent ice
    (Antarctica incl. the Dry Valleys), where dryness rests on precipitation alone.
Overall = mean of the features that count in the layer (equal weights). Missing data in a feature that
counts scores 0 (penalised); a feature that does not count in the layer has no effect.

Output: data/interim/scores_<layer>.npz

Usage: python -I pipeline/score.py data/interim [0-1m|1-5m|gt5m]
"""
import json
import sys
from pathlib import Path

import numpy as np

LAYERS = {
    # temperature quantities: (name, earth source, earth key, mars key)
    "0-1m": {"temp": [(q, "era5", q, q) for q in
                      ("tmin", "tmax", "amp", "summer_tmin", "summer_tmax", "summer_amp")],
             "ice_earth": "shallow_ice", "polygons": True, "dryness": True},
    "1-5m": {"temp": [("t_1_5", "grid", "t_1_5", "t_1_5")], "ice_earth": "ice_1_5", "polygons": True,
             "dryness": False},
    "gt5m": {"temp": [("t_gt5", "grid", "t_gt5", "t_gt5")], "ice_earth": "ice_gt5", "polygons": False,
             "dryness": False},
}
DRYNESS_QUANTITIES = ("wet_summer", "precip_mm_yr")


def rank01(values: np.ndarray) -> np.ndarray:
    """Fraction of other values strictly below each value (ties share the lowest rank), NaN kept."""
    out = np.full(values.shape, np.nan)
    ok = np.isfinite(values)
    v = values[ok]
    order = np.sort(v)
    out[ok] = np.searchsorted(order, v, side="left") / max(v.size - 1, 1)
    return out


def midrank01(values: np.ndarray) -> np.ndarray:
    """Mid-rank percentile in [0, 1]: ties share the average of 'below' and 'below or equal'."""
    out = np.full(values.shape, np.nan)
    ok = np.isfinite(values)
    v = values[ok]
    order = np.sort(v)
    out[ok] = (np.searchsorted(order, v, "left") + np.searchsorted(order, v, "right")) / (2 * v.size)
    return out


def main(interim: Path, layer: str) -> None:
    cfg = LAYERS[layer]
    grid = np.load(interim / "earth_grid.npz")
    era5 = np.load(interim / "era5_skin_2023.npz")
    src = {"grid": grid, "era5": era5}
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))

    rows, cols = np.nonzero(grid["permafrost"])
    n = rows.size
    quantities = [q for q, *_ in cfg["temp"]]
    earth_t = np.stack([src[s][k][rows, cols].astype(np.float64) for _, s, k, _ in cfg["temp"]])
    ice_e = grid[cfg["ice_earth"]][rows, cols].astype(np.float64)
    ice_e_pct = midrank01(ice_e)

    n_sites = len(sites)
    temp_parts = np.full((n_sites, len(quantities), n), np.nan)
    ice = np.full((n_sites, n), np.nan)
    for i, s in enumerate(sites):
        for j, (_, _, _, mk) in enumerate(cfg["temp"]):
            temp_parts[i, j] = 1.0 - rank01(np.abs(earth_t[j] - s["temperature"][mk]))
        ice[i] = 1.0 - np.abs(ice_e_pct - s["ice"][layer]["percentile"])
    temperature = temp_parts.mean(axis=1)  # NaN where any temperature input is missing

    # Thermal-contraction polygons (position match): Earth cracking potential vs SWIM polygon share.
    polygons = np.full((n_sites, n), np.nan)
    crack_pct = midrank01(grid["crack"][rows, cols].astype(np.float64))
    if cfg["polygons"]:
        for i, s in enumerate(sites):
            if s["polygons"]["status"] == "ok":
                polygons[i] = 1.0 - np.abs(crack_pct - s["polygons"]["percentile"])

    # Dryness: Mars has ~no liquid water and no precipitation, so the driest Earth cell ranks first.
    # Same value for every Mars site.
    dry = np.load(interim / "dryness_2023.npz")
    earth_dry = np.stack([dry[q][rows, cols].astype(np.float64) for q in DRYNESS_QUANTITIES])
    dry_parts = np.stack([1.0 - rank01(v) for v in earth_dry])
    # Mean of the parts that have data: on permanent ice (e.g. the Dry Valleys) SMAP wetness is missing
    # but ERA5-Land precipitation exists, so dryness rests on precipitation alone there.
    # Only a cell with neither part is "no data" (and then penalised below).
    n_parts = np.isfinite(dry_parts).sum(axis=0)
    dryness_cell = np.where(n_parts > 0, np.nansum(dry_parts, axis=0) / np.maximum(n_parts, 1), np.nan)
    dryness = np.tile(dryness_cell, (n_sites, 1)) if cfg["dryness"] else np.full((n_sites, n), np.nan)

    # Missing-data rule (team decision 2026-11-14): a feature that counts in this Depth Layer and has no
    # data (on either planet) scores 0 - it is penalised. A feature that does not count in this layer
    # (polygons below 5 m, dryness below 1 m) is left out of the mean and has no effect.
    feats = ([temperature, ice] + ([polygons] if cfg["polygons"] else [])
             + ([dryness] if cfg["dryness"] else []))
    overall = np.mean(np.stack([np.nan_to_num(f, nan=0.0) for f in feats]), axis=0)

    best_site = np.argmax(overall, axis=0)
    best = overall[best_site, np.arange(n)]
    pct = rank01(best)
    order = np.argsort(-best, kind="stable")
    rank = np.empty(n, dtype=np.int64)
    rank[order] = np.arange(1, n + 1)

    out = interim / f"scores_{layer}.npz"
    np.savez_compressed(
        out, layer=layer, rows=rows, cols=cols, site_ids=np.array([s["id"] for s in sites]),
        temp_quantities=np.array(quantities), temp_mars_keys=np.array([mk for *_, mk in cfg["temp"]]),
        temp_parts=temp_parts.astype(np.float32), temperature=temperature.astype(np.float32),
        ice=ice.astype(np.float32), polygons=polygons.astype(np.float32), crack=grid["crack"][rows, cols],
        gst=grid["gst"][rows, cols], overall=overall.astype(np.float32),
        dryness=dryness.astype(np.float32), dry_parts=dry_parts.astype(np.float32), earth_dry=earth_dry,
        dry_quantities=np.array(DRYNESS_QUANTITIES),
        best_site=best_site, best=best.astype(np.float32), percentile=pct.astype(np.float32), rank=rank,
        earth_temp=earth_t, ice_earth_name=cfg["ice_earth"], ice_earth=ice_e,
        shallow_ice=grid["shallow_ice"][rows, cols], alt=grid["alt"][rows, cols], pfr=grid["pfr"][rows, cols],
    )
    print(layer, "cells", n, "with temperature", int(np.isfinite(earth_t).all(axis=0).sum()))
    for i, s in enumerate(sites):
        print(f"  {s['id']:22s} best-for {int((best_site == i).sum()):6d} cells, max score {np.nanmax(overall[i]):.3f}")
    print("saved", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "0-1m")
