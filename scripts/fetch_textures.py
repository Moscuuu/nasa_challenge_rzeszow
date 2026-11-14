"""Fetch Earth (Blue Marble NG via NASA GIBS WMS) and Mars (Viking MDIM 2.1 via NASA Trek) colour textures.

Usage (from repo root): python scripts/fetch_textures.py <output_dir>
Writes earth_color_{4k,2k}.jpg and mars_color_{4k,2k}.jpg (equirectangular, left edge = 180 W).
Downloads go to a fresh temp dir; only the final JPEGs reach the output dir.
"""
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
UA = "analog-finder-texture-fetch/1.0"
EARTH_URL = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
             "&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326"
             "&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048&FORMAT=image/jpeg")
MARS_LAYER = "Mars_Viking_MDIM21_ClrMosaic_global_232m"
MARS_TILE = ("https://trek.nasa.gov/tiles/Mars/EQ/" + MARS_LAYER +
             "/1.0.0/default/default028mm/{z}/{row}/{col}.jpg")
ZOOM, ROWS, COLS, TILE = 3, 8, 16, 256  # verified empirically: 16x8 tiles = 4096x2048
MAX_BYTES = 3 * 1024 * 1024


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def save_jpeg(img: Image.Image, path: Path) -> None:
    for q in range(85, 40, -5):
        img.convert("RGB").save(path, "JPEG", quality=q, optimize=True)
        if path.stat().st_size < MAX_BYTES:
            return
    raise RuntimeError(f"{path} still >= 3 MB at quality 45")


def write_pair(img: Image.Image, out: Path, name: str) -> None:
    save_jpeg(img.resize((4096, 2048), Image.LANCZOS), out / f"{name}_4k.jpg")
    save_jpeg(img.resize((2048, 1024), Image.LANCZOS), out / f"{name}_2k.jpg")


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="textures-"))
    try:
        earth_src = tmp / "earth.jpg"
        data = get(EARTH_URL)
        if data[:3] != bytes([0xFF, 0xD8, 0xFF]):
            raise RuntimeError("GIBS did not return a JPEG: " + data[:200].decode("utf-8", "replace"))
        earth_src.write_bytes(data)
        write_pair(Image.open(earth_src), out, "earth_color")

        mars = Image.new("RGB", (COLS * TILE, ROWS * TILE))
        for row in range(ROWS):
            for col in range(COLS):
                p = tmp / f"{row}_{col}.jpg"
                p.write_bytes(get(MARS_TILE.format(z=ZOOM, row=row, col=col)))
                mars.paste(Image.open(p).convert("RGB"), (col * TILE, row * TILE))
        write_pair(mars, out, "mars_color")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
