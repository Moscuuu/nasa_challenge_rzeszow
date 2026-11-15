"""Summer daytime land surface temperature of the permafrost part of each Earth Cell (NASA MODIS Aqua via
Earth Engine), year 2023. This is the Earth side of the summer_temperature feature in score.py.

Why not ERA5-Land skin temperature: ERA5-Land is a 9 km model on smoothed orography. In mountains it gives
the temperature of the cell's mean height, not of the high ground that holds the permafrost (Andes cells
came out at +23..+45 C). MODIS is observed at 1 km, so the mean can be taken over the permafrost pixels only,
the same way earth_grid.py takes PZI's air temperature over them (maat_pf).

Per 30 arc-second pixel (the PZI grid, 12 x 12 per 0.1 deg cell):
  lst        mean of MYD11A1 v6.1 LST_Day_1km over local summer (Jun-Aug 2023 north of the equator,
             Dec 2022-Feb 2023 south of it). Aqua passes at ~13:30 local solar time, close to the daily
             maximum, and LST exists only on clear-sky days, which suits Mars (thin, mostly cloud-free sky).
  snow_free  share of cloud-free summer days without snow (MOD10A1 NDSI_Snow_Cover < 40), as in
             fetch_surface.py.
A pixel is used when it has LST, is snow-free on at least half of its summer days (bare ground, not glacier)
and, where PZI exists (north of 60 S), has PZI >= 0.5 (permafrost).

Produces data/interim/lst_summer_2023.npz (1800 x 3600, row 0 = 90 N, col 0 = -180):
  lst_summer_pf    mean LST over the used pixels [K] (NaN where none)
  lst_summer_bare  mean LST over all snow-free pixels with LST, permafrost or not [K] (diagnostic)
  n_pf_pixels      number of used pixels (0..144)

Usage: python pipeline/fetch_lst.py data/interim/lst_summer_2023.npz data/interim/earth_grid.npz data/raw/pzi
"""
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ee_init import init  # noqa: E402

YEAR = 2023
NX, NY, RES = 3600, 1800, 0.1
FINE = 12  # 30 arc-second pixels per cell side: the PZI grid
ROWS_PER_CHUNK, COLS_PER_CHUNK = 20, 150
WORKERS = int(os.environ.get("EE_WORKERS", 8))  # parallel requests; 2 in Earth Engine restricted mode
ROW_RANGE = (50, 1750)  # skip the polar caps (|lat| > 85): requests touching the pole fail
PZI_SHAPE = (18000, 43200)  # 90 N .. 60 S
PZI_ROWS = PZI_SHAPE[0] // FINE  # cell rows covered by PZI (0..1499)
SNOW_NDSI = 40
SNOW_FREE_PIXEL_MIN = 0.5
PZI_PIXEL_MIN = 0.5


def stats_image(ee):
    lst = ee.ImageCollection("MODIS/061/MYD11A1").select("LST_Day_1km")
    snow = ee.ImageCollection("MODIS/061/MOD10A1").select("NDSI_Snow_Cover")

    def season(start, end):
        t = lst.filterDate(start, end).mean().multiply(0.02)  # scale factor -> K
        free = snow.filterDate(start, end).map(lambda im: im.lt(SNOW_NDSI)).mean()
        return t.unmask(-1).rename("lst"), free.unmask(-1).rename("snow_free")

    jt, jf = season(f"{YEAR}-06-01", f"{YEAR}-09-01")
    dt, df = season(f"{YEAR - 1}-12-01", f"{YEAR}-03-01")
    north = ee.Image.pixelLonLat().select("latitude").gte(0)
    # unmask before combining hemispheres (see fetch_surface.py: where() keeps the first image's mask)
    return jt.where(north.Not(), dt).addBands(jf.where(north.Not(), df)).toFloat()


def main(out: Path, grid_path: Path, pzi_dir: Path) -> None:
    ee = init()
    img = stats_image(ee)
    wanted = np.load(grid_path)["permafrost"]
    pzi = np.memmap(pzi_dir / "PZI.flt", dtype="<f4", mode="r", shape=PZI_SHAPE)
    lst_pf = np.full((NY, NX), np.nan, dtype=np.float32)
    lst_bare = np.full((NY, NX), np.nan, dtype=np.float32)
    n_pf = np.zeros((NY, NX), dtype=np.int16)
    chunks = [(r0, c0) for r0 in range(ROW_RANGE[0], ROW_RANGE[1], ROWS_PER_CHUNK)
              for c0 in range(0, NX, COLS_PER_CHUNK)
              if wanted[r0:r0 + ROWS_PER_CHUNK, c0:c0 + COLS_PER_CHUNK].any()]
    print("chunks", len(chunks), flush=True)

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
        for attempt in range(6):
            try:
                return chunk, np.load(io.BytesIO(ee.data.computePixels(req)))
            except Exception as e:  # EE quota / transient errors: back off and retry
                if attempt == 5:
                    raise
                print("retry", chunk, str(e)[:100], flush=True)
                time.sleep(15 * (attempt + 1))

    def cell_mean(values, mask):
        v = np.where(mask, values, 0.0).reshape(ROWS_PER_CHUNK, FINE, COLS_PER_CHUNK, FINE)
        n = mask.reshape(ROWS_PER_CHUNK, FINE, COLS_PER_CHUNK, FINE).sum(axis=(1, 3))
        with np.errstate(invalid="ignore", divide="ignore"):
            return np.where(n > 0, v.sum(axis=(1, 3)) / n, np.nan), n

    with ThreadPoolExecutor(WORKERS) as pool:
        for i, ((r0, c0), data) in enumerate(pool.map(fetch, chunks)):
            t = np.asarray(data["lst"], dtype=np.float64)
            free = np.asarray(data["snow_free"], dtype=np.float64)
            bare = (t > 0) & (free >= SNOW_FREE_PIXEL_MIN)
            # PZI for these pixels; south of its limit every bare pixel counts (Antarctica: CCI mask decides)
            pf = np.ones_like(bare)
            pr0, pr1 = r0 * FINE, min((r0 + ROWS_PER_CHUNK), PZI_ROWS) * FINE
            if pr1 > pr0:
                p = np.asarray(pzi[pr0:pr1, c0 * FINE:(c0 + COLS_PER_CHUNK) * FINE])
                pf[: pr1 - pr0] = p >= PZI_PIXEL_MIN
            rs, cs = slice(r0, r0 + ROWS_PER_CHUNK), slice(c0, c0 + COLS_PER_CHUNK)
            lst_pf[rs, cs], n_pf[rs, cs] = cell_mean(t, bare & pf)
            lst_bare[rs, cs], _ = cell_mean(t, bare)
            if i % 50 == 0:
                print(f"chunk {i + 1}/{len(chunks)}", flush=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, lst_summer_pf=lst_pf, lst_summer_bare=lst_bare, n_pf_pixels=n_pf)
    print("saved", out, "cells with LST over permafrost:", int(np.isfinite(lst_pf).sum()),
          "of", int(wanted.sum()), "permafrost cells")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
