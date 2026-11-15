"""Dryness inputs on the global 0.1 deg grid, year 2023 (via Earth Engine).

Produces data/interim/dryness_2023.npz (1800 x 3600, row 0 = 90 N, col 0 = -180):
  wet_summer     NASA SMAP L4 (SPL4SMGP v8) surface (0-5 cm) soil wetness, fraction of saturation, mean over
                 local summer (Jun-Aug north of the equator, Dec 2022-Feb 2023 south of it). One 3-hourly
                 step per day (13:30 UTC): wetness changes slowly, and a full 3-hourly year exceeds EE user memory.
                 NaN on permanent ice (SMAP L4 mask: Antarctica incl. the Dry Valleys, ice sheets) and water.
  precip_mm_yr   ECMWF ERA5-Land total precipitation, 2023 [mm / year] (DAILY_AGGR). Covers Antarctica.
                 (SMAP L4's own precipitation is GEOS model forcing, not a SMAP measurement.)

Usage: python pipeline/fetch_smap.py data/interim/dryness_2023.npz
"""
import io
import sys
from pathlib import Path

import ee
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ee_init import init as ee_init  # noqa: E402  (service account; see scripts/ee_init.py)

YEAR = 2023
NX, NY, RES = 3600, 1800, 0.1
ROWS_PER_CHUNK = 100
COL_CHUNKS = 2  # requests spanning the full +-180 range fail at the antimeridian
# All land between 85 N and 85 S: the PZI mask adds mountain permafrost at low latitudes (Andes etc.).
ROW_RANGES = [(50, 1750)]


def stats_image() -> ee.Image:
    smap = (ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select("sm_surface_wetness")
            .filter(ee.Filter.calendarRange(13, 13, "hour")))  # steps are at 01:30, 04:30, ... UTC
    jja = smap.filterDate(f"{YEAR}-06-01", f"{YEAR}-09-01").mean()
    djf = smap.filterDate(f"{YEAR - 1}-12-01", f"{YEAR}-03-01").mean()
    north = ee.Image.pixelLonLat().select("latitude").gte(0)
    wet = djf.where(north, jja).rename("wet_summer")
    precip = (ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
              .filterDate(f"{YEAR}-01-01", f"{YEAR + 1}-01-01")
              .select("total_precipitation_sum").sum().multiply(1000).rename("precip_mm_yr"))  # m -> mm
    return wet.addBands(precip).toFloat()


def main(out: Path) -> None:
    ee_init()
    img = stats_image()
    bands = ["wet_summer", "precip_mm_yr"]
    arrays = {b: np.full((NY, NX), np.nan, dtype=np.float32) for b in bands}
    width = NX // COL_CHUNKS
    starts = [(r0, last) for first, last in ROW_RANGES for r0 in range(first, last, ROWS_PER_CHUNK)]
    for r0, last in starts:
        rows = min(ROWS_PER_CHUNK, last - r0)
        lat_top = 90 - r0 * RES
        for c0 in range(0, NX, width):
            req = {
                "expression": img,
                "fileFormat": "NPY",
                "grid": {
                    "dimensions": {"width": width, "height": rows},
                    "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": -180 + c0 * RES,
                                        "shearY": 0, "scaleY": -RES, "translateY": lat_top},
                    "crsCode": "EPSG:4326",
                },
            }
            data = np.load(io.BytesIO(ee.data.computePixels(req)))
            for b in bands:
                a = np.ma.getdata(data[b]).astype(np.float32)
                a[np.ma.getmaskarray(data[b])] = np.nan
                arrays[b][r0:r0 + rows, c0:c0 + width] = a
        print(f"rows {r0}-{r0 + rows} lat {lat_top:.1f}", flush=True)
    # masked pixels can come back as 0: wetness is never exactly 0 on SMAP land pixels
    arrays["wet_summer"][arrays["wet_summer"] <= 0] = np.nan
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, **arrays)
    print("saved", out, "cells with wetness", int(np.isfinite(arrays["wet_summer"]).sum()),
          "with precipitation", int(np.isfinite(arrays["precip_mm_yr"]).sum()))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
