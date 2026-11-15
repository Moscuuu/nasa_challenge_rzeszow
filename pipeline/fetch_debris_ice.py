"""Massive ice under a debris cover on Earth: debris-covered glaciers and rock glaciers, per Earth Cell.
This is the Earth side of the massive_ice feature in score.py (analog of the Martian lobate debris aprons
and buried ice sheets, see the ice_type of each site in mars_sites.py).

Per 30 arc-second pixel (12 x 12 per 0.1 deg cell), via Earth Engine:
  debris  1 where the pixel is massive ice under debris, by any of:
            - inside a GLIMS glacier outline (glac_bound, minus internal rock outcrops) AND snow-free on at
              least half of its cloud-free summer days (MOD10A1 NDSI_Snow_Cover < 40). Clean glacier ice and
              firn read as snow in NDSI; a glacier surface that is "snow-free" all summer is debris-covered.
            - inside a GLIMS debris-cover outline (line_type debris_cov)
            - inside a GLIMS rock glacier (primeclass 9)
  glacier 1 inside any GLIMS glacier outline (context)
Summer = Jun-Aug 2023 north of the equator, Dec 2022-Feb 2023 south of it (as fetch_surface.py).

Limits: GLIMS outlines are of different dates and quality; most rock glaciers are not in GLIMS (regional
inventories); debris-covered ice outside any outline (e.g. ice-cored moraines, buried ice in Beacon Valley
beyond the glacier outline) is missed. A cell with 0 is "not known to have massive ice", not "has none".

Produces data/interim/debris_ice_2023.npz (1800 x 3600, row 0 = 90 N, col 0 = -180):
  debris_ice_share   share of the cell's pixels that are massive ice under debris (0..1; NaN = not requested)
  glacier_share      share inside any GLIMS glacier outline

Usage: python pipeline/fetch_debris_ice.py data/interim/debris_ice_2023.npz data/interim/earth_grid.npz
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
FINE = 12
ROWS_PER_CHUNK, COLS_PER_CHUNK = 20, 150
WORKERS = int(os.environ.get("EE_WORKERS", 8))  # parallel requests; 2 in Earth Engine restricted mode
ROW_RANGE = (50, 1750)
SNOW_NDSI = 40
SNOW_FREE_PIXEL_MIN = 0.5
GLIMS = "GLIMS/20230607"


def stats_image(ee):
    g = ee.FeatureCollection(GLIMS)
    glac = g.filter(ee.Filter.eq("line_type", "glac_bound"))
    zero = ee.Image(0).byte()
    in_glacier = zero.paint(glac, 1)
    rock_inside = zero.paint(g.filter(ee.Filter.eq("line_type", "intrnl_rock")), 1)
    debris_line = zero.paint(g.filter(ee.Filter.eq("line_type", "debris_cov")), 1)
    rock_glacier = zero.paint(glac.filter(ee.Filter.eq("primeclass", 9)), 1)

    snow = ee.ImageCollection("MODIS/061/MOD10A1").select("NDSI_Snow_Cover")

    def free(start, end):
        return snow.filterDate(start, end).map(lambda im: im.lt(SNOW_NDSI)).mean().unmask(0)

    north = ee.Image.pixelLonLat().select("latitude").gte(0)
    snow_free = free(f"{YEAR - 1}-12-01", f"{YEAR}-03-01").where(north, free(f"{YEAR}-06-01", f"{YEAR}-09-01"))
    bare_ice = in_glacier.And(rock_inside.Not()).And(snow_free.gte(SNOW_FREE_PIXEL_MIN))
    debris = bare_ice.Or(debris_line).Or(rock_glacier).rename("debris")
    return debris.addBands(in_glacier.rename("glacier")).toByte()


def fetch_block(ee, img, r0, c0, rows, cols):
    req = {
        "expression": img,
        "fileFormat": "NPY",
        "grid": {
            "dimensions": {"width": cols * FINE, "height": rows * FINE},
            "affineTransform": {"scaleX": RES / FINE, "shearX": 0, "translateX": -180 + c0 * RES,
                                "shearY": 0, "scaleY": -RES / FINE, "translateY": 90 - r0 * RES},
            "crsCode": "EPSG:4326",
        },
    }
    for attempt in range(6):
        try:
            return np.load(io.BytesIO(ee.data.computePixels(req)))
        except Exception as e:  # EE quota / transient errors: back off and retry
            if attempt == 5:
                raise
            print("retry", (r0, c0), str(e)[:100], flush=True)
            time.sleep(15 * (attempt + 1))


def cell_share(a, rows, cols):
    return a.reshape(rows, FINE, cols, FINE).mean(axis=(1, 3))


def main(out: Path, grid_path: Path) -> None:
    ee = init()
    img = stats_image(ee)
    wanted = np.load(grid_path)["permafrost"]
    debris = np.full((NY, NX), np.nan, dtype=np.float32)
    glacier = np.full((NY, NX), np.nan, dtype=np.float32)
    chunks = [(r0, c0) for r0 in range(ROW_RANGE[0], ROW_RANGE[1], ROWS_PER_CHUNK)
              for c0 in range(0, NX, COLS_PER_CHUNK)
              if wanted[r0:r0 + ROWS_PER_CHUNK, c0:c0 + COLS_PER_CHUNK].any()]
    print("chunks", len(chunks), flush=True)

    def fetch(chunk):
        return chunk, fetch_block(ee, img, chunk[0], chunk[1], ROWS_PER_CHUNK, COLS_PER_CHUNK)

    with ThreadPoolExecutor(WORKERS) as pool:
        for i, ((r0, c0), data) in enumerate(pool.map(fetch, chunks)):
            rs, cs = slice(r0, r0 + ROWS_PER_CHUNK), slice(c0, c0 + COLS_PER_CHUNK)
            debris[rs, cs] = cell_share(np.asarray(data["debris"], dtype=np.float32), ROWS_PER_CHUNK, COLS_PER_CHUNK)
            glacier[rs, cs] = cell_share(np.asarray(data["glacier"], dtype=np.float32), ROWS_PER_CHUNK, COLS_PER_CHUNK)
            if i % 50 == 0:
                print(f"chunk {i + 1}/{len(chunks)}", flush=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, debris_ice_share=debris, glacier_share=glacier)
    pf = wanted & np.isfinite(debris)
    print("saved", out, "permafrost cells with debris ice > 0:", int((debris[pf] > 0).sum()),
          ">= 10 %:", int((debris[pf] >= 0.1).sum()))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
