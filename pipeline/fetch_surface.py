"""Surface state on the global 0.1 deg grid, year 2023 (NASA MODIS via Earth Engine).

Produces data/interim/surface_2023.npz (1800 x 3600, row 0 = 90 N, col 0 = -180):
  snow_free_summer  share of cloud-free local-summer observations without snow, 0..1
                    (MOD10A1 v6.1 NDSI_Snow_Cover < 40 per day; read at 0.02 deg and averaged over the
                    cell, NaN where there is no cloud-free observation; Jun-Aug north of the equator,
                    Dec 2022-Feb 2023 south of it).
                    Low values = permanent snow / glacier / ice sheet; high values = bare ground in summer.
                    It does NOT separate wet tundra from dry permafrost: both are snow-free in summer.
  ice_fraction      share of the cell classed "permanent snow and ice" (MCD12Q1 v6.1 2023, IGBP class 15).
                    Not usable in Antarctica: the product labels the whole continent, Dry Valleys included,
                    as ice. Use snow_free_summer there.

Usage: python pipeline/fetch_surface.py data/interim/surface_2023.npz
"""
import io
import sys
import time
import warnings
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ee_init import init  # noqa: E402

YEAR = 2023
NX, NY, RES = 3600, 1800, 0.1
ROWS_PER_CHUNK, COLS_PER_CHUNK = 25, 300  # small chunks keep each Earth Engine request within its budget
WORKERS = 8  # parallel requests
FINE = 5  # each cell is requested as FINE x FINE sub-pixels (0.02 deg) and averaged here
ROW_RANGE = (50, 1750)  # skip the polar caps (|lat| > 85): requests touching the pole fail
SNOW_NDSI = 40  # NDSI_Snow_Cover >= 40 counts as snow (the usual 0.4 NDSI threshold)


def stats_image(ee):
    snow = ee.ImageCollection("MODIS/061/MOD10A1").select("NDSI_Snow_Cover")

    def free_share(ic):
        return ic.map(lambda im: im.lt(SNOW_NDSI)).mean()

    jja = free_share(snow.filterDate(f"{YEAR}-06-01", f"{YEAR}-09-01"))
    djf = free_share(snow.filterDate(f"{YEAR - 1}-12-01", f"{YEAR}-03-01"))
    north = ee.Image.pixelLonLat().select("latitude").gte(0)
    # Masked pixels would come back as 0 ("always snow"): mark them -1 and turn them into NaN locally.
    # Unmask BEFORE combining the hemispheres: where() keeps the mask of its first image, and the northern
    # polar night has no Dec-Feb observations, which blanked everything north of ~77 N.
    free = jja.unmask(-1).where(north.Not(), djf.unmask(-1)).rename("snow_free_summer")
    lc = (ee.ImageCollection("MODIS/061/MCD12Q1").filterDate(f"{YEAR}-01-01", f"{YEAR + 1}-01-01")
          .first().select("LC_Type1"))
    ice = lc.eq(15).rename("ice_fraction")
    return free.addBands(ice.unmask(-1)).toFloat()


def main(out: Path, cells_path: Path | None) -> None:
    ee = init()
    img = stats_image(ee)
    bands = ["snow_free_summer", "ice_fraction"]
    arrays = {b: np.full((NY, NX), np.nan, dtype=np.float32) for b in bands}
    # Only chunks that contain Earth Cells of permafrost are requested (saves most of the globe).
    wanted = np.load(cells_path)["permafrost"] if cells_path and cells_path.exists() else None
    chunks = [(r0, c0) for r0 in range(ROW_RANGE[0], ROW_RANGE[1], ROWS_PER_CHUNK)
              for c0 in range(0, NX, COLS_PER_CHUNK)
              if wanted is None or wanted[r0:r0 + ROWS_PER_CHUNK, c0:c0 + COLS_PER_CHUNK].any()]

    def fetch(chunk):
        r0, c0 = chunk
        req = {
            "expression": img,
            "fileFormat": "NPY",
            "grid": {
                "dimensions": {"width": COLS_PER_CHUNK * FINE, "height": ROWS_PER_CHUNK * FINE},
                "affineTransform": {"scaleX": RES / FINE, "shearX": 0, "translateX": -180 + c0 * RES,
                                    "shearY": 0, "scaleY": -RES / FINE, "translateY": 90 - r0 * RES},
                "crsCode": "EPSG:4326",
            },
        }
        for attempt in range(4):
            try:
                return chunk, np.load(io.BytesIO(ee.data.computePixels(req)))
            except Exception as e:  # EE quota / transient errors: back off and retry
                if attempt == 3:
                    raise
                time.sleep(10 * (attempt + 1))
                print("retry", chunk, str(e)[:80], flush=True)

    with ThreadPoolExecutor(WORKERS) as pool:
        for i, ((r0, c0), data) in enumerate(pool.map(fetch, chunks)):
            for b in bands:
                a = np.asarray(data[b], dtype=np.float32)
                a[a < 0] = np.nan  # masked: no cloud-free observation / no land-cover value
                a = a.reshape(ROWS_PER_CHUNK, FINE, COLS_PER_CHUNK, FINE)
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN cells stay NaN
                    arrays[b][r0:r0 + ROWS_PER_CHUNK, c0:c0 + COLS_PER_CHUNK] = np.nanmean(a, axis=(1, 3))
            if i % 20 == 0:
                print(f"chunk {i + 1}/{len(chunks)}", flush=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, **arrays)
    print("saved", out, {b: int(np.isfinite(arrays[b]).sum()) for b in bands})


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None)
