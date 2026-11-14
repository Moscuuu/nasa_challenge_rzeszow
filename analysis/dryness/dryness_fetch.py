"""Dryness layer for the Earth grid: precipitation (ERA5-Land) + greenness (MODIS NDVI).

Goal: kill the "wet tundra" trap. Phoenix-like analogs are cold AND dry AND bare.

Two inputs, both from Google Earth Engine, on the same 0.1 deg grid as the other layers
(cell centres at -179.95 ... 179.95, -89.95 ... 89.95; same as ggd318_analyze.py):

    precip_mm_yr  mean annual precipitation (rain + snow), mm/yr
                  ECMWF/ERA5_LAND/MONTHLY_AGGR, band total_precipitation_sum, years --start..--end
    ndvi_max      typical annual maximum NDVI (median over years of each year's max)
                  MODIS/061/MOD13A3 (monthly, 1 km), averaged to 0.1 deg

Scores (0..1, 1 = most Mars-like = driest / barest on Earth), ranked among land cells:

    s_precip  = 1 - percentile(precip_mm_yr)
    s_ndvi    = 1 - percentile(ndvi_max)
    s_dry     = geometric mean of the available ones (if NDVI is missing, s_dry = s_precip)

Outputs (in --out):
    dryness_grid_0p1deg.csv.gz   lat, lon, precip_mm_yr, ndvi_max, s_precip, s_ndvi, s_dry
    regions.csv                  median values for test regions (known analogs + wet-tundra control)
    map_dryness.png              world map of s_dry

Usage:
    python analysis/dryness/dryness_fetch.py                     # 2014-2023, out=data/dryness
    python analysis/dryness/dryness_fetch.py --start 2019 --end 2023 --out data/dryness
    python analysis/dryness/dryness_fetch.py --from-cache        # rescore/replot without EE

Caveat: precipitation models are least reliable near the poles (few gauges). Use the ranking,
not the exact mm. NDVI is the independent second check.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

STEP = 0.1
WIDTH, HEIGHT = 3600, 1800
STRIP = 100  # rows per request (10 deg of latitude)

# (lon0, lat0, lon1, lat1). Same names as the other analyses where they overlap.
REGIONS = {
    "dry_valleys": (160.5, -78.0, 163.0, -77.2),            # known analog: should be dry
    "devon_island_haughton": (-90.5, 75.0, -88.5, 75.6),    # known analog
    "axel_heiberg": (-95.0, 78.5, -88.0, 81.0),
    "north_ellesmere": (-80.0, 81.0, -70.0, 82.5),          # candidate (CCI)
    "peary_land": (-40.0, 82.0, -20.0, 83.5),               # candidate (CCI)
    "qiangtang": (82.0, 33.0, 90.0, 36.0),
    "ojos_del_salado": (-69.5, -28.0, -67.5, -26.0),
    "atacama_yungay": (-70.3, -24.4, -69.8, -23.9),          # hyperarid reference
    "alaska_north_slope": (-157.0, 69.5, -150.0, 70.8),     # wet tundra: MUST score low
    "svalbard_bockfjord": (13.0, 79.2, 14.5, 79.6),
}


def build_images(ee, start: int, end: int):
    years = ee.List.sequence(start, end)

    def precip_year(y):
        y = ee.Number(y)
        col = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        return col.select("total_precipitation_sum").sum().multiply(1000)  # m -> mm

    def ndvi_year(y):
        y = ee.Number(y)
        col = ee.ImageCollection("MODIS/061/MOD13A3").filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        return col.select("NDVI").max().multiply(0.0001)

    precip = ee.ImageCollection(years.map(precip_year)).mean().rename("precip_mm_yr")
    precip = precip.resample("bilinear")

    ndvi = ee.ImageCollection(years.map(ndvi_year)).median().rename("ndvi_max")
    # MODIS sinusoidal can't be transformed near the poles, so declare a plain 0.01 deg
    # lat/lon grid (~1 km, like MOD13A3) and average 10x10 of those into each 0.1 deg cell.
    ndvi = ndvi.setDefaultProjection(
        "EPSG:4326", [0.01, 0, -180, 0, -0.01, 90]
    ).reduceResolution(ee.Reducer.mean(), maxPixels=1024)
    return {"precip_mm_yr": precip, "ndvi_max": ndvi}


def fetch_band(ee, img, name: str, lat_limit: float = 90.0) -> np.ndarray:
    # West and east halves separately: a full 360 deg request breaks reduceResolution
    # (source grid wider than EE's 32768 px limit / dateline edge transform).
    # lat_limit < 90 skips the poles, where reduceResolution can't transform the grid edge.
    out = np.full((HEIGHT, WIDTH), np.nan, dtype=np.float32)
    half = WIDTH // 2
    skip = int(round((90 - lat_limit) / STEP))
    for r0 in range(skip, HEIGHT - skip, STRIP):
        rows = min(STRIP, HEIGHT - skip - r0)
        lat_top = 90 - r0 * STEP
        for c0 in (0, half):
            req = {
                "expression": img.unmask(-9999),
                "fileFormat": "NUMPY_NDARRAY",
                "grid": {
                    "dimensions": {"width": half, "height": rows},
                    "affineTransform": {
                        "scaleX": STEP, "shearX": 0, "translateX": -180.0 + c0 * STEP,
                        "shearY": 0, "scaleY": -STEP, "translateY": lat_top,
                    },
                    "crsCode": "EPSG:4326",
                },
            }
            a = np.asarray(ee.data.computePixels(req)[name], dtype=np.float32)
            a[a <= -9998] = np.nan
            out[r0:r0 + rows, c0:c0 + half] = a
        print(f"  {name}: lat {lat_top:6.1f} .. {lat_top - rows * STEP:6.1f}  "
              f"valid {np.isfinite(out[r0:r0 + rows]).mean():5.1%}", flush=True)
    return out


def to_table(bands: dict) -> pd.DataFrame:
    lats = 90 - STEP / 2 - np.arange(HEIGHT) * STEP
    lons = -180 + STEP / 2 + np.arange(WIDTH) * STEP
    LON, LAT = np.meshgrid(lons, lats)
    df = pd.DataFrame({"lat": LAT.ravel().round(3), "lon": LON.ravel().round(3)})
    for k, v in bands.items():
        df[k] = v.ravel()
    return df[df["precip_mm_yr"].notna()].reset_index(drop=True)  # land cells only


def score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["s_precip"] = 1 - df["precip_mm_yr"].rank(pct=True)
    df["s_ndvi"] = 1 - df["ndvi_max"].rank(pct=True)  # NaN stays NaN
    both = np.sqrt(df["s_precip"].clip(lower=1e-6) * df["s_ndvi"].clip(lower=1e-6))
    df["s_dry"] = both.where(df["s_ndvi"].notna(), df["s_precip"])
    return df


def regions(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for name, (lon0, lat0, lon1, lat1) in REGIONS.items():
        m = df["lon"].between(lon0, lon1) & df["lat"].between(lat0, lat1)
        sub = df[m]
        rows.append({
            "region": name, "cells": len(sub),
            "precip_mm_yr": sub["precip_mm_yr"].median(),
            "ndvi_max": sub["ndvi_max"].median(),
            "ndvi_cover": sub["ndvi_max"].notna().mean() if len(sub) else np.nan,
            "s_precip": sub["s_precip"].median(),
            "s_ndvi": sub["s_ndvi"].median(),
            "s_dry": sub["s_dry"].median(),
        })
    return pd.DataFrame(rows).round(3)


def plot(df: pd.DataFrame, out: Path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    grid = np.full((HEIGHT, WIDTH), np.nan)
    r = np.round((90 - STEP / 2 - df["lat"]) / STEP).astype(int)
    c = np.round((df["lon"] + 180 - STEP / 2) / STEP).astype(int)
    grid[r, c] = df["s_dry"]
    fig, ax = plt.subplots(figsize=(14, 7))
    im = ax.imshow(grid, extent=(-180, 180, -90, 90), cmap="YlOrBr", vmin=0, vmax=1)
    for name, (lon0, lat0, lon1, lat1) in REGIONS.items():
        ax.add_patch(plt.Rectangle((lon0, lat0), lon1 - lon0, lat1 - lat0,
                                   fill=False, ec="blue", lw=1))
        ax.text(lon1 + 1, lat1, name, fontsize=6, color="blue")
    ax.set_title("Dryness score s_dry (1 = driest and barest on Earth)")
    fig.colorbar(im, ax=ax, shrink=0.7)
    fig.savefig(out, dpi=150, bbox_inches="tight")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", type=int, default=2014)
    ap.add_argument("--end", type=int, default=2023)
    ap.add_argument("--out", default="data/dryness")
    ap.add_argument("--from-cache", action="store_true", help="reuse raw .npy, skip Earth Engine")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = ["precip_mm_yr", "ndvi_max"]

    if args.from_cache:
        bands = {n: np.load(out / f"raw_{n}.npy") for n in names}
    else:
        from ee_init import init
        ee = init()
        imgs = build_images(ee, args.start, args.end)
        bands = {}
        for n in names:
            cache = out / f"raw_{n}.npy"
            if cache.exists():
                print(f"{n}: using cached {cache}")
                bands[n] = np.load(cache)
                continue
            print(f"fetching {n} ({args.start}-{args.end}) ...", flush=True)
            # NDVI: no vegetated land beyond 85 deg (only ice), and the poles break the grid.
            bands[n] = fetch_band(ee, imgs[n], n, lat_limit=85.0 if n == "ndvi_max" else 90.0)
            np.save(cache, bands[n])

    df = score(to_table(bands))
    df.to_csv(out / "dryness_grid_0p1deg.csv.gz", index=False)
    print(f"grid: {len(df)} land cells -> {out / 'dryness_grid_0p1deg.csv.gz'}")

    reg = regions(df)
    reg.to_csv(out / "regions.csv", index=False)
    print(reg.to_string(index=False))

    plot(df, out / "map_dryness.png")
    print(f"map -> {out / 'map_dryness.png'}")


if __name__ == "__main__":
    main()
