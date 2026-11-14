"""Experiment Window for the top cells: months and local hours when the Earth cell's surface temperature
falls inside a Mars site's typical daily range [mean daily min, mean daily max] (whole Mars year).

ERA5-Land hourly skin temperature, 2023, averaged into a month x UTC-hour climatology (288 values per cell)
and shifted to local solar time by longitude.

Output: data/interim/experiment_window_0-1m.json  {cell_id: {site_id: {months, hours_local, hours_per_year}}}

Usage: python pipeline/experiment_window.py data/interim [0-1m|1-5m|gt5m]
"""
import json
import sys
from pathlib import Path

import ee
import numpy as np

LAYER = sys.argv[2] if len(sys.argv) > 2 else "0-1m"  # Depth Layer
RES = 0.1
TOP_N = 2000
BATCH = 250
YEAR = 2023
DAYS = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


def climatology_image() -> ee.Image:
    ic = (ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY")
          .filterDate(f"{YEAR}-01-01", f"{YEAR + 1}-01-01").select("skin_temperature"))
    bands = []
    for m in range(1, 13):
        icm = ic.filter(ee.Filter.calendarRange(m, m, "month"))
        for h in range(24):
            bands.append(icm.filter(ee.Filter.calendarRange(h, h, "hour")).mean().rename(f"m{m:02d}h{h:02d}"))
    return ee.Image.cat(bands)


def main(interim: Path) -> None:
    ee.Initialize()
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))
    with np.load(interim / f"scores_{LAYER}.npz") as z:
        sc = {k: z[k] for k in z.files}
    top = np.argsort(-np.nan_to_num(sc["best"], nan=-1), kind="stable")[:TOP_N]
    lat = 90 - (sc["rows"][top] + 0.5) * RES
    lon = -180 + (sc["cols"][top] + 0.5) * RES
    img = climatology_image()
    names = [f"m{m:02d}h{h:02d}" for m in range(1, 13) for h in range(24)]

    clim = np.full((top.size, 12, 24), np.nan)
    for b0 in range(0, top.size, BATCH):
        idx = range(b0, min(b0 + BATCH, top.size))
        fc = ee.FeatureCollection([ee.Feature(ee.Geometry.Point(float(lon[i]), float(lat[i])), {"i": int(i)}) for i in idx])
        res = img.sampleRegions(collection=fc, scale=11132, geometries=False).getInfo()
        for f in res["features"]:
            p = f["properties"]
            clim[p["i"]] = np.array([p.get(n, np.nan) for n in names], dtype=float).reshape(12, 24)
        print("batch", b0, "sampled", len(res["features"]), flush=True)

    out = {}
    for i in range(top.size):
        if not np.isfinite(clim[i]).any():
            continue
        shift = int(round(lon[i] / 15.0))  # local solar hour = UTC + lon/15
        local = np.roll(clim[i], shift, axis=1)  # column h now = local hour h
        cid = f"c_{lat[i]:.2f}_{lon[i]:.2f}"
        cell = {}
        for s in sites:
            lo, hi = s["temperature"]["tmin"], s["temperature"]["tmax"]
            inside = (local >= lo) & (local <= hi)
            hours = int((inside.sum(axis=1) * DAYS).sum())
            cell[s["id"]] = {
                "months": [m + 1 for m in range(12) if inside[m].any()],
                "hours_local": [h for h in range(24) if inside[:, h].any()],
                "hours_per_year": hours,
                "mars_range_K": [lo, hi],
            }
        out[cid] = cell
    (interim / f"experiment_window_{LAYER}.json").write_text(json.dumps(out), encoding="utf-8")
    print("cells with window data", len(out))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
