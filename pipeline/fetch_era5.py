"""ERA5-Land surface (skin) temperature statistics on the global 0.1 deg grid, via Earth Engine.

Produces data/interim/era5_skin_2023.npz with arrays (1800 x 3600, row 0 = 90..89.9 N, col 0 = -180..-179.9):
  tmin  mean daily minimum skin temperature [K]
  tmax  mean daily maximum skin temperature [K]
  amp   mean daily amplitude (max - min) [K]
  summer_tmin, summer_tmax, summer_amp   the same over local summer
        (Jun-Aug 2023 north of the equator, Dec 2022-Feb 2023 south of it)
Daily min/max come from ECMWF/ERA5_LAND/DAILY_AGGR (UTC days).

Usage: python pipeline/fetch_era5.py data/interim/era5_skin_2023.npz
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
ROWS_PER_CHUNK = 150


def _min_max_amp(ic: ee.ImageCollection, prefix: str) -> ee.Image:
    amp = ic.map(lambda im: im.select("skin_temperature_max")
                 .subtract(im.select("skin_temperature_min")).rename("amp"))
    return ic.mean().rename([f"{prefix}tmin", f"{prefix}tmax"]).addBands(amp.mean().rename(f"{prefix}amp"))


def stats_image() -> ee.Image:
    """Whole-year stats plus local-summer stats (JJA north of the equator, DJF south of it)."""
    daily = (ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
             .select(["skin_temperature_min", "skin_temperature_max"]))
    year = daily.filterDate(f"{YEAR}-01-01", f"{YEAR + 1}-01-01")
    jja = daily.filterDate(f"{YEAR}-06-01", f"{YEAR}-09-01")
    djf = daily.filterDate(f"{YEAR - 1}-12-01", f"{YEAR}-03-01")
    north = ee.Image.pixelLonLat().select("latitude").gte(0)
    summer = _min_max_amp(djf, "summer_").where(north, _min_max_amp(jja, "summer_"))
    return _min_max_amp(year, "").addBands(summer).toFloat()


def main(out: Path) -> None:
    ee_init()
    img = stats_image()
    bands = ["tmin", "tmax", "amp", "summer_tmin", "summer_tmax", "summer_amp"]
    arrays = {b: np.full((NY, NX), np.nan, dtype=np.float32) for b in bands}
    half = NX // 2  # requests spanning the full +-180 range fail at the antimeridian
    # Skip the polar caps (|lat| > 85): requests touching the pole fail, and CCI has no data there.
    first, last = 50, NY - 50
    for r0 in range(first, last, ROWS_PER_CHUNK):
        rows = min(ROWS_PER_CHUNK, last - r0)
        lat_top = 90 - r0 * RES
        for c0 in (0, half):
            req = {
                "expression": img,
                "fileFormat": "NPY",
                "grid": {
                    "dimensions": {"width": half, "height": rows},
                    "affineTransform": {"scaleX": RES, "shearX": 0, "translateX": -180 + c0 * RES,
                                        "shearY": 0, "scaleY": -RES, "translateY": lat_top},
                    "crsCode": "EPSG:4326",
                },
            }
            data = np.load(io.BytesIO(ee.data.computePixels(req)))
            for b in bands:
                arrays[b][r0:r0 + rows, c0:c0 + half] = data[b].astype(np.float32)
        print(f"rows {r0}-{r0 + rows} lat {lat_top:.1f}", flush=True)
    for b in bands:
        a = arrays[b]
        a[a <= 0] = np.nan  # masked (ocean) pixels come back as 0
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, **arrays)
    print("saved", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
