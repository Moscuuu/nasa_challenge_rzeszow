"""Score Earth Cells of permafrost as places to test drilling into ground ice like at the 7 Mars Base
Candidate Sites, for one Depth Layer.

Mars sets the conditions; it is not matched by rank. At every candidate site the ice lies under a dry
cover and never thaws, and the ground is far colder than anywhere on Earth, so:

Filters (a cell must pass all; thresholds in config.py):
    ground temperature of the Depth Layer <= -5 C     (the ice stays hard-frozen; colder is not "more Mars")
    active-layer thickness <= 0.5 m, where known        (summer thaw stays in the cover, above the ice)
    snow-free share of summer >= 10 %                   (bare ground exists: not a glacier or ice sheet)
    glacier / ice-sheet share < 50 %                    (not used in Antarctica, where the map is unusable)

Features (0..1, higher = closer to the Mars conditions), the same for every region type:
    summer_temperature  1 - |Earth - Mars| / 20 K. Earth: MODIS Aqua daytime land surface temperature
                        (~13:30, clear sky) in local summer, averaged over the cell's snow-free permafrost
                        pixels (fetch_lst.py). Mars: mean daily maximum in local summer (thermal model).
                        Compared in kelvin. The only feature that differs between Mars sites.
    dryness             rank among the cells that passed the filters, driest = 1; mean of annual
                        precipitation (ERA5-Land) and summer surface wetness (SMAP L4) where each exists
    bare_ground         snow-free share of summer observations (MODIS)

Cold is a filter only. Daily amplitude, cracking potential and the percentile match of ice are gone
(see the spec for why).

Region types (northern, antarctic, pzi_only = outside CCI coverage) all use the same three features,
so scores are comparable across types; type ranks are kept as extra information. ice_table (1 - ALT / 0.5 m)
is still computed for context but not scored: ALT is missing outside CCI and ~0 m in Antarctica, and the
ALT filter already keeps summer thaw in the cover. A cell that lacks a feature (e.g. no clear-sky LST over
its permafrost pixels) is left unscored; nothing is filled with 0 or skipped.

Mars sites. A site counts in a Depth Layer only if SWIM shows ice there (C > 0.1). The best site of a
cell is the applicable site with the highest score; ties are common and are reported.

Robustness. The score is recomputed under 20 variants (-5 / -10 C, ALT 0.5 / 1.0 m, each feature left
out in turn). stability = share of variants in which the cell is in the top 10 % of its region type.

Areas. The exported top cells are grouped into areas of at most 5 x 5 cells around the best cell;
a lone cell is an area of one, so no cell is dropped.

Output: data/interim/scores_<layer>.npz

Usage: python pipeline/score.py data/interim [0-1m|1-5m|gt5m]
"""
import json
import sys
from contextlib import nullcontext
from pathlib import Path

import numpy as np

import config as C


def rank01(values: np.ndarray) -> np.ndarray:
    """Fraction of other values strictly below each value (ties share the lowest rank), NaN kept."""
    out = np.full(values.shape, np.nan)
    ok = np.isfinite(values)
    v = values[ok]
    order = np.sort(v)
    out[ok] = np.searchsorted(order, v, side="left") / max(v.size - 1, 1)
    return out


def load_cells(interim: Path) -> dict:
    grid = np.load(interim / "earth_grid.npz")
    lst = np.load(interim / "lst_summer_2023.npz")
    dry = np.load(interim / "dryness_2023.npz")
    surf = np.load(interim / "surface_2023.npz")
    rows, cols = np.nonzero(grid["permafrost"])
    pick = lambda a: a[rows, cols].astype(np.float64)  # noqa: E731
    cells = {"rows": rows, "cols": cols, "region": grid["region"][rows, cols],
             "temp_source": grid["temp_source"][rows, cols]}
    for name in ("gst", "t_1_5", "t_gt5", "alt", "pfr", "pzi_share", "maat_pf"):
        cells[name] = pick(grid[name])
    cells["summer_tmax"] = pick(lst["lst_summer_pf"])
    # ERA5-Land summer skin maximum: comparison only (not scored), if the file has it
    era5_path = interim / "era5_skin_2023.npz"
    with np.load(era5_path) if era5_path.exists() else nullcontext({}) as era5:
        cells["summer_tmax_era5"] = pick(era5["summer_tmax"]) if "summer_tmax" in era5 else np.full(rows.size, np.nan)
    precip = pick(dry["precip_mm_yr"])  # masked cells (coast, sea) come back from Earth Engine as -inf or 0
    cells["precip_mm_yr"] = np.where(np.isfinite(precip) & (precip > 0), precip, np.nan)
    cells["wet_summer"] = pick(dry["wet_summer"])
    cells["snow_free_summer"] = pick(surf["snow_free_summer"])
    cells["ice_fraction"] = pick(surf["ice_fraction"])
    return cells


def compute(cells: dict, sites: list, layer: str, t_max: float = C.T_GROUND_MAX_K,
            alt_max: float = C.ALT_MAX_M, drop: str | None = None) -> dict:
    """Filters, features and scores for one Depth Layer under one set of thresholds."""
    region = cells["region"]
    antarctic, mountain = region == 1, region == 2
    t = cells[C.LAYER_TEMP[layer]]
    alt = cells["alt"]
    with np.errstate(invalid="ignore"):
        passes = {
            "temperature": np.isfinite(t) & (t <= t_max),
            "thaw_depth": (alt <= alt_max) | (mountain & ~np.isfinite(alt)),
            "bare_ground": cells["snow_free_summer"] >= C.SNOW_FREE_MIN,
            "not_ice": antarctic | (cells["ice_fraction"] < C.ICE_FRACTION_MAX),
        }
    eligible = np.logical_and.reduce(list(passes.values()))

    n_sites, n = len(sites), region.size
    mars_tmax = np.array([s["temperature"]["summer_tmax"] for s in sites])[:, None]
    feats = {
        "summer_temperature": 1.0 - np.clip(np.abs(cells["summer_tmax"][None, :] - mars_tmax) / C.SUMMER_T_SCALE_K, 0, 1),
        "ice_table": np.tile(1.0 - np.clip(alt / alt_max, 0.0, 1.0), (n_sites, 1)),
        "bare_ground": np.tile(cells["snow_free_summer"], (n_sites, 1)),
    }
    # Dryness is ranked among the cells that passed the filters: "driest of the candidates".
    dry_parts = np.stack([1.0 - rank01(np.where(eligible, cells[q], np.nan)) for q in ("precip_mm_yr", "wet_summer")])
    n_parts = np.isfinite(dry_parts).sum(axis=0)
    dryness = np.where(n_parts > 0, np.nansum(dry_parts, axis=0) / np.maximum(n_parts, 1), np.nan)
    feats["dryness"] = np.tile(dryness, (n_sites, 1))

    overall = np.full((n_sites, n), np.nan)
    for r, name in enumerate(C.REGION_TYPES):
        used = [f for f in C.TYPE_FEATURES[name] if f != drop]
        sel = eligible & (region == r)
        if used and sel.any():
            overall[:, sel] = np.mean(np.stack([feats[f][:, sel] for f in used]), axis=0)  # NaN if any is missing

    site_ok = np.array([s["ice"][layer]["c"] > C.SWIM_ICE_MIN for s in sites])
    masked = np.where(site_ok[:, None], overall, np.nan)
    scored = np.isfinite(masked).any(axis=0)
    best_site = np.where(scored, np.nanargmax(np.where(np.isfinite(masked), masked, -1.0), axis=0), -1)
    best = np.where(scored, masked[np.maximum(best_site, 0), np.arange(n)], np.nan)
    type_pct = np.full(n, np.nan)
    for r in range(len(C.REGION_TYPES)):
        sel = scored & (region == r)
        type_pct[sel] = rank01(best[sel])
    return {"passes": passes, "eligible": eligible, "feats": feats, "dry_parts": dry_parts, "overall": overall,
            "site_ok": site_ok, "scored": scored, "best_site": best_site, "best": best, "type_pct": type_pct}


def stability(cells: dict, sites: list, layer: str) -> tuple[np.ndarray, int]:
    """Share of threshold / feature variants in which each cell is in the top 10 % of its region type."""
    hits = np.zeros(cells["region"].size)
    variants = [(t, a, d) for t in (C.T_GROUND_MAX_K, 263.15) for a in (C.ALT_MAX_M, 1.0)
                for d in (None,) + C.FEATURES]
    for t_max, alt_max, drop in variants:
        pct = compute(cells, sites, layer, t_max, alt_max, drop)["type_pct"]
        hits += np.nan_to_num(pct, nan=-1.0) >= C.STABLE_PERCENTILE
    return hits / len(variants), len(variants)


def group_areas(rows: np.ndarray, cols: np.ndarray, best: np.ndarray, top: np.ndarray) -> np.ndarray:
    """Greedy grouping of the top cells: the best free cell seeds an area that takes every free top cell
    within AREA_MAX_CELLS x AREA_MAX_CELLS around it (same region type). Returns area id per cell (-1 = none)."""
    area = np.full(rows.size, -1, dtype=np.int32)
    half = C.AREA_MAX_CELLS // 2
    where = {(int(rows[k]), int(cols[k])): int(k) for k in top}
    next_id = 0
    for k in top[np.argsort(-best[top], kind="stable")]:
        if area[k] >= 0:
            continue
        for dr in range(-half, half + 1):
            for dc in range(-half, half + 1):
                j = where.get((int(rows[k]) + dr, (int(cols[k]) + dc) % C.NX))
                if j is not None and area[j] < 0:
                    area[j] = next_id
        next_id += 1
    return area


def main(interim: Path, layer: str) -> None:
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))
    cells = load_cells(interim)
    res = compute(cells, sites, layer)
    region, best, scored = cells["region"], res["best"], res["scored"]
    n = region.size

    pct = rank01(best)  # among all scored cells, for the map and the method check
    order = np.argsort(-np.nan_to_num(best, nan=-1.0), kind="stable")
    rank = np.full(n, -1, dtype=np.int64)
    rank[order[: int(scored.sum())]] = np.arange(1, int(scored.sum()) + 1)
    type_rank = np.full(n, -1, dtype=np.int64)
    top = []
    for r in range(len(C.REGION_TYPES)):
        idx = np.nonzero(scored & (region == r))[0]
        idx = idx[np.argsort(-best[idx], kind="stable")]
        type_rank[idx] = np.arange(1, idx.size + 1)
        top.append(idx[: C.TOP_PER_TYPE])
        for i in np.nonzero(res["site_ok"])[0]:  # each site's own best cells of this type
            v = res["overall"][i, idx]
            ok = np.isfinite(v)
            top.append(idx[ok][np.argsort(-v[ok], kind="stable")[: C.TOP_PER_SITE]])
    top = np.unique(np.concatenate(top))
    stab, n_variants = stability(cells, sites, layer)
    area = group_areas(cells["rows"], cells["cols"], best, top)

    # Are the features independent? (Spearman among scored cells; cold must not sneak back in.)
    names = ["t_ground", "summer_tmax", "alt", "precip_mm_yr", "wet_summer", "snow_free_summer"]
    vals = [cells[C.LAYER_TEMP[layer]]] + [cells[k] for k in names[1:]]
    corr = {}
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            ok = scored & np.isfinite(vals[i]) & np.isfinite(vals[j])
            if ok.sum() > 100:
                a, b = rank01(vals[i][ok]), rank01(vals[j][ok])
                corr[f"{names[i]}~{names[j]}"] = round(float(np.corrcoef(a, b)[0, 1]), 2)

    out = interim / f"scores_{layer}.npz"
    np.savez_compressed(
        out, layer=layer, rows=cells["rows"], cols=cells["cols"], region=region,
        site_ids=np.array([s["id"] for s in sites]), site_ok=res["site_ok"],
        eligible=res["eligible"], scored=scored,
        **{f"pass_{k}": v for k, v in res["passes"].items()},
        **{f"feat_{k}": v.astype(np.float32) for k, v in res["feats"].items()},
        dry_parts=res["dry_parts"].astype(np.float32),
        overall=res["overall"].astype(np.float32), best_site=res["best_site"], best=best.astype(np.float32),
        percentile=pct.astype(np.float32), rank=rank, type_percentile=res["type_pct"].astype(np.float32),
        type_rank=type_rank, stability=stab.astype(np.float32), n_variants=n_variants, top=top, area=area,
        t_ground=cells[C.LAYER_TEMP[layer]], temp_source=cells["temp_source"],
        **{k: cells[k] for k in ("summer_tmax", "summer_tmax_era5", "alt", "pfr", "pzi_share", "maat_pf", "precip_mm_yr", "wet_summer",
                                 "snow_free_summer", "ice_fraction")},
        spearman=json.dumps(corr),
    )
    print(layer, "permafrost cells", n, "pass filters", int(res["eligible"].sum()), "scored", int(scored.sum()))
    for k, v in res["passes"].items():
        print(f"  filter {k:12s} passes {int(v.sum()):7d}")
    for r, name in enumerate(C.REGION_TYPES):
        sel = region == r
        print(f"  {name:10s} cells {int(sel.sum()):7d}  scored {int((scored & sel).sum()):6d}  "
              f"stable (>= 0.8) {int((stab[sel] >= 0.8).sum()):5d}")
    for i, s in enumerate(sites):
        tag = "" if res["site_ok"][i] else "  (no SWIM ice in this layer: not used)"
        print(f"  {s['id']:22s} best-for {int((res['best_site'] == i).sum()):6d} cells{tag}")
    print("  areas", int(area.max()) + 1, "from", top.size, "top cells; Spearman", corr)
    print("saved", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "0-1m")
