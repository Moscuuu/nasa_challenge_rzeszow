"""Download Natural Earth 10m layers used to name Earth Cells (public domain).

  ne_10m_admin_0_countries        country names
  ne_10m_geography_regions_polys  named physical regions (ranges, plateaus, basins, deserts)

Usage: python -I pipeline/fetch_places.py data/raw/naturalearth
"""
import sys
import zipfile
from pathlib import Path

import requests

BASE = "https://naciscdn.org/naturalearth/10m"
LAYERS = {
    "ne_10m_admin_0_countries": f"{BASE}/cultural/ne_10m_admin_0_countries.zip",
    "ne_10m_geography_regions_polys": f"{BASE}/physical/ne_10m_geography_regions_polys.zip",
}
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, url in LAYERS.items():
        target = out_dir / name
        if (target / f"{name}.shp").exists():
            print("skip", name)
            continue
        zpath = out_dir / f"{name}.zip"
        r = requests.get(url, timeout=300, headers=HEADERS)
        r.raise_for_status()
        zpath.write_bytes(r.content)
        with zipfile.ZipFile(zpath) as z:
            for m in z.namelist():
                if m.startswith("/") or ".." in Path(m).parts:
                    raise ValueError(f"unsafe path in zip: {m}")
            z.extractall(target)
        print("done", name, len(r.content) >> 10, "kB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
