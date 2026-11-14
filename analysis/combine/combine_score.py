"""Combine Earth layers into one Mars-analog score per 0.1 deg cell, per Mars target site.

Inputs (all on the shared 0.1 deg grid, cell centres x.x5):
    data/permafrost_cci/cci_grid_0p1deg.csv.gz      GST, ALT, PFR      (analysis/permafrost_cci/cci_grid.py)
    data/dryness/dryness_grid_0p1deg.csv.gz         s_dry               (analysis/dryness/dryness_fetch.py)
    data/nsidc_ggd318/out/grid_0p1deg.csv.gz        ice_ord (NH only)   (analysis/nsidc_ggd318/ggd318_analyze.py)
    data/swim/mars_sites.csv                        Mars target profiles (analysis/swim/swim_sites.py)

Five factors, each 0..1 (1 = most Mars-like):
    s_cold   extremity: percentile of -GST among CCI cells (Earth never reaches Mars temperatures)
    s_crack  cracking regime from GST (cold-dry 1, active 0.6, relict 0.2, none 0) vs Mars polygon
             occurrence p: 1 - |regime - p|   (skipped when the site has no polygon survey)
    s_depth  Earth ALT vs Mars ice depth, Gaussian in log space: factor 3 off -> 0.61, 10x -> 0.11
             (ALT is thaw depth, a stand-in for ice-table depth; Antarctic ALT is likely too low)
    s_ice    Earth ice = PFR/100 x GGD318 content (high 1, medium .75, low .5; 1 if unmapped)
             vs Mars ice_strength: 1 - |earth - mars|
    s_dry    precipitation + NDVI ranking (same for every Mars site)

Score S(cell, site) = geometric mean of available factors (floor 0.01), so one bad factor sinks it.
Mars twin = site with the highest S. Only sites with ice_strength > 0.3 can be twins.

Validation: known Mars analogs must score high, wet permafrost references low. Compared against a
cold-only baseline. Threshold = score that 80 % of the known terrain analogs reach.

Outputs (data/combine/):
    cells_scored.csv.gz   per cell: factors for the twin, S per site, twin, score
    validation.csv        known/reference sites: score, percentile, twin, cold-only percentile
    areas.csv             connected groups of cells above threshold, ranked
    map_score.png         Arctic + Antarctic score maps with areas

Usage: python analysis/combine/combine_score.py
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage

STEP = 0.1
FLOOR = 0.01
SIGMA_LOG = np.log(3.0)
MIN_ALT = 0.02  # m; ALT 0 in Antarctica -> treat as 2 cm
ICE_ORD_W = {1: 0.5, 2: 0.75, 3: 1.0}

# (lat, lon, kind): kind "analog" = known terrain analog (sets threshold),
# "process" = local/process analog (reported only), "reference" = wet/warm permafrost, should be low.
SITES = {
    "University Valley": (-77.86, 160.72, "analog"),
    "Beacon Valley": (-77.83, 160.65, "analog"),
    "Don Juan Pond": (-77.56, 161.19, "analog"),
    "Taylor Valley": (-77.61, 163.15, "analog"),
    "Axel Heiberg (Expedition Fd.)": (79.40, -90.80, "analog"),
    "Haughton Crater": (75.38, -89.68, "analog"),
    "Eureka (Ellesmere)": (79.99, -85.93, "analog"),
    "Bockfjorden (Svalbard)": (79.45, 13.33, "process"),
    "Utqiagvik (Alaska)": (71.29, -156.79, "reference"),
    "Tuktoyaktuk": (69.44, -133.03, "reference"),
    "Duvanny Yar": (68.63, 159.15, "reference"),
    "Adventdalen (Svalbard)": (78.20, 15.85, "reference"),
    "Beiluhe (Tibet)": (34.82, 92.92, "reference"),
}


def key(lat, lon):
    """Integer cell index on the 0.1 deg grid (robust join key)."""
    return (np.floor(np.asarray(lat) / STEP).astype(np.int64) * 10000
            + np.floor(np.asarray(lon) / STEP).astype(np.int64))


def load(args) -> tuple[pd.DataFrame, pd.DataFrame]:
    cci = pd.read_csv(args.cci)
    dry = pd.read_csv(args.dry, usecols=["lat", "lon", "s_dry", "precip_mm_yr", "ndvi_max"])
    ggd = pd.read_csv(args.ggd, usecols=["lat", "lon", "ice_ord", "glacier"])
    for d in (cci, dry, ggd):
        d["k"] = key(d["lat"], d["lon"])
    df = cci[cci["PFR"].fillna(0) > 0].copy()  # cells with some permafrost
    df = df.merge(dry.drop(columns=["lat", "lon"]), on="k", how="left")
    df = df.merge(ggd.drop(columns=["lat", "lon"]).drop_duplicates("k"), on="k", how="left")
    sites = pd.read_csv(args.mars)
    return df.reset_index(drop=True), sites


def factors(df: pd.DataFrame) -> pd.DataFrame:
    df["s_cold"] = (-df["GST"]).rank(pct=True)
    g = df["GST"]
    df["crack_regime"] = np.select([g <= -20, g <= -6, g <= -2], [1.0, 0.6, 0.2], 0.0)
    w = df["ice_ord"].map(ICE_ORD_W).fillna(1.0)
    df["earth_ice"] = (df["PFR"] / 100).clip(0, 1) * w
    df["alt_m"] = df["ALT"].clip(lower=MIN_ALT)
    return df


def site_factors(df: pd.DataFrame, s: pd.Series) -> dict:
    out = {"s_cold": df["s_cold"], "s_dry": df["s_dry"]}
    out["s_ice"] = 1 - (df["earth_ice"] - s["ice_strength"]).abs()
    if pd.notna(s["ice_depth_m"]):
        z = np.log(df["alt_m"] / s["ice_depth_m"]) / SIGMA_LOG
        out["s_depth"] = np.exp(-0.5 * z ** 2).where(df["ALT"].notna())
    if pd.notna(s["poly"]):
        out["s_crack"] = 1 - (df["crack_regime"] - s["poly"]).abs()
    return out


def geomean(parts: dict) -> pd.Series:
    m = pd.DataFrame(parts).clip(lower=FLOOR)
    return np.exp(np.log(m).mean(axis=1, skipna=True))


def score(df: pd.DataFrame, sites: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    eligible = sites[sites["ice_strength"] > 0.3]
    names = list(eligible["id"])
    per_site = {}
    for _, s in eligible.iterrows():
        parts = site_factors(df, s)
        df[f"S_{s['id']}"] = geomean(parts)
        per_site[s["id"]] = parts
    S = df[[f"S_{n}" for n in names]]
    df["score"] = S.max(axis=1)
    df["twin"] = S.idxmax(axis=1).str[2:]
    # factor values for the twin
    for f in ["s_ice", "s_depth", "s_crack"]:
        df[f] = np.nan
        for n in names:
            if f in per_site[n]:
                m = df["twin"] == n
                df.loc[m, f] = per_site[n][f][m]
    df["pct"] = df["score"].rank(pct=True) * 100
    df["pct_cold_only"] = df["s_cold"].rank(pct=True) * 100
    return df, names


def validate(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for name, (lat, lon, kind) in SITES.items():
        near = df[(df["lat"].sub(lat).abs() <= 0.15) & (df["lon"].sub(lon).abs() <= 0.15 / max(np.cos(np.radians(lat)), 0.2))]
        if near.empty:
            rows.append({"site": name, "kind": kind, "note": "no permafrost cell nearby"})
            continue
        best = near.loc[near["score"].idxmax()]
        rows.append({
            "site": name, "kind": kind, "score": best["score"], "pct": best["pct"],
            "pct_cold_only": near["pct_cold_only"].max(), "twin": best["twin"],
            "GST": best["GST"], "ALT": best["ALT"], "PFR": best["PFR"], "s_dry": best["s_dry"],
        })
    return pd.DataFrame(rows)


def areas(df: pd.DataFrame, thr: float, sites: pd.DataFrame, min_cells: int) -> pd.DataFrame:
    hi = df[df["score"] >= thr]
    ii = np.floor((hi["lat"] + 90) / STEP).astype(int).to_numpy()
    jj = np.floor((hi["lon"] + 180) / STEP).astype(int).to_numpy()
    grid = np.zeros((1800, 3600), dtype=bool)
    grid[ii, jj] = True
    lab, n = ndimage.label(grid, structure=np.ones((3, 3)))
    hi = hi.assign(area_id=lab[ii, jj])
    site_name = dict(zip(sites["id"], sites["name"]))
    rows = []
    for aid, g in hi.groupby("area_id"):
        if len(g) < min_cells:
            continue
        cell_km2 = (STEP * 111.32) ** 2 * np.cos(np.radians(g["lat"]))
        known = [nm for nm, (la, lo, k) in SITES.items()
                 if k != "reference" and ((g["lat"] - la).abs() < 0.2).any()
                 and ((g["lon"] - lo).abs() < 0.2 / max(np.cos(np.radians(la)), 0.2)).any()
                 and (((g["lat"] - la) ** 2 + ((g["lon"] - lo) * np.cos(np.radians(la))) ** 2).min() < 0.2 ** 2)]
        twin = g["twin"].mode().iat[0]
        tw = g[g["twin"] == twin]
        fac = {f: tw[f].median() for f in ["s_cold", "s_dry", "s_ice", "s_depth", "s_crack"]}
        fac = {k: v for k, v in fac.items() if pd.notna(v)}
        rows.append({
            "area_id": int(aid), "cells": len(g), "area_km2": round(float(cell_km2.sum())),
            "lat": round(float(g["lat"].mean()), 2), "lon": round(float(g["lon"].mean()), 2),
            "score_p90": round(float(g["score"].quantile(0.9)), 3),
            "score_max": round(float(g["score"].max()), 3),
            "twin": twin, "twin_name": site_name.get(twin, twin),
            "known": bool(known), "known_sites": "; ".join(known),
            "GST_med": round(float(g["GST"].median()), 1), "ALT_med": round(float(g["ALT"].median()), 2),
            "precip_med": round(float(g["precip_mm_yr"].median()), 0),
            "strengths": ", ".join(k for k, _ in sorted(fac.items(), key=lambda x: -x[1])[:2]),
            "breaks_down": ", ".join(k for k, _ in sorted(fac.items(), key=lambda x: x[1])[:2]),
            **{k: round(float(v), 2) for k, v in fac.items()},
        })
    out = pd.DataFrame(rows).sort_values("score_p90", ascending=False).reset_index(drop=True)
    out.insert(0, "rank", np.arange(1, len(out) + 1))
    return out


def plot(df: pd.DataFrame, ar: pd.DataFrame, out: Path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    for ax, (name, sel, ext) in zip(axes, [
        ("Arctic (CCI 25-85N)", df["lat"] > 0, (-180, 180, 25, 85)),
        ("Antarctica (ice-free)", df["lat"] < 0, (-180, 180, -85, -60)),
    ]):
        d = df[sel]
        sc = ax.scatter(d["lon"], d["lat"], c=d["score"], s=0.3, cmap="magma", vmin=0, vmax=1)
        a = ar[(ar["lat"] > 0) == (ext[2] > 0)].head(25)
        ax.scatter(a["lon"], a["lat"], s=40, facecolors="none", edgecolors="cyan", lw=1)
        for _, r in a.iterrows():
            ax.text(r["lon"] + 1, r["lat"], str(r["rank"]), color="cyan", fontsize=7)
        for nm, (la, lo, k) in SITES.items():
            if (la > 0) == (ext[2] > 0):
                ax.plot(lo, la, marker="x" if k == "reference" else "^",
                        color="red" if k == "reference" else "lime", ms=5)
        ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.set_title(name)
    fig.colorbar(sc, ax=axes, shrink=0.6, label="Mars-analog score (max over Mars targets)")
    fig.suptitle("Combined score. Cyan = ranked areas, green ^ = known analogs, red x = wet/warm references")
    fig.savefig(out, dpi=150, bbox_inches="tight")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cci", default="data/permafrost_cci/cci_grid_0p1deg.csv.gz")
    ap.add_argument("--dry", default="data/dryness/dryness_grid_0p1deg.csv.gz")
    ap.add_argument("--ggd", default="data/nsidc_ggd318/out/grid_0p1deg.csv.gz")
    ap.add_argument("--mars", default="data/swim/mars_sites.csv")
    ap.add_argument("--out", default="data/combine")
    ap.add_argument("--min-cells", type=int, default=3)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    df, sites = load(args)
    df = factors(df)
    df, names = score(df, sites)
    print(f"cells scored: {len(df)}  | Mars twins: {names}")

    val = validate(df)
    known = val[val["kind"] == "analog"]["score"].dropna()
    thr = float(known.quantile(0.2))
    print(f"\nthreshold (80 % of known terrain analogs pass): {thr:.3f}")
    with pd.option_context("display.width", 200):
        print(val.round(2).to_string(index=False))

    def auc(col):
        a = val[val["kind"] == "analog"][col].dropna().to_numpy()
        r = val[val["kind"] == "reference"][col].dropna().to_numpy()
        return float(np.mean([x > y for x in a for y in r])) if len(a) and len(r) else np.nan

    summary = {
        "threshold": thr,
        "known_median_pct": float(val[val["kind"] == "analog"]["pct"].median()),
        "reference_median_pct": float(val[val["kind"] == "reference"]["pct"].median()),
        "known_vs_reference_separation": auc("pct"),
        "cold_only_separation": auc("pct_cold_only"),
        "mars_twins": names,
    }
    print("\n" + json.dumps(summary, indent=2))

    ar = areas(df, thr, sites, args.min_cells)
    print(f"\nareas above threshold: {len(ar)} (known: {int(ar['known'].sum())}, new: {int((~ar['known']).sum())})")
    cols = ["rank", "lat", "lon", "area_km2", "score_p90", "twin", "known_sites", "GST_med", "ALT_med",
            "precip_med", "strengths", "breaks_down"]
    with pd.option_context("display.width", 250, "display.max_colwidth", 40):
        print(ar[cols].head(25).to_string(index=False))

    keep = ["lat", "lon", "region", "GST", "ALT", "PFR", "ice_ord", "precip_mm_yr", "ndvi_max",
            "s_cold", "s_dry", "s_ice", "s_depth", "s_crack", "score", "pct", "twin"] + [f"S_{n}" for n in names]
    df[keep].round(3).to_csv(out / "cells_scored.csv.gz", index=False)
    val.round(3).to_csv(out / "validation.csv", index=False)
    ar.to_csv(out / "areas.csv", index=False)
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    plot(df, ar, out / "map_score.png")
    print(f"\n-> {out}/cells_scored.csv.gz, validation.csv, areas.csv, summary.json, map_score.png")


if __name__ == "__main__":
    main()
