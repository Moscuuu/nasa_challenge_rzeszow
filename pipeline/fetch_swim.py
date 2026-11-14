"""Download SWIM4MIM ice-consistency composites (GeoTIFF, 0.05 deg, 60S-60N).

Usage: python -I pipeline/fetch_swim.py data/raw/swim [0_1 1_5 5]
"""
import sys
from pathlib import Path

import requests

BASE = "https://swim.psi.edu/output/SWIM4MIM/Global/Composite"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def main(out_dir: Path, layers: list[str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for layer in layers:
        name = f"SWIM4MIM_Ci_{layer}.tif"
        target = out_dir / name
        if target.exists() and target.stat().st_size > 0:
            print("skip", name)
            continue
        print("get", name, flush=True)
        with requests.get(f"{BASE}/{name}", stream=True, timeout=600, headers=HEADERS) as r:
            r.raise_for_status()
            tmp = target.with_suffix(".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(target)
        print("done", name, target.stat().st_size >> 20, "MB", flush=True)


LANDFORMS_ZIP = "https://swim.psi.edu/output/SWIM4MIM/Global/Datasets/SWIM4MIM_G_0_1_Ancillary.zip"


def fetch_landforms(out_dir: Path) -> None:
    """10 landform maps (incl. polygons) from the 0-1 m geomorphology ancillary zip, into out_dir/landforms."""
    import zipfile

    target = out_dir / "landforms"
    if target.exists() and any(target.rglob("*.tif")):
        print("skip landforms")
        return
    zpath = out_dir / "SWIM4MIM_G_0_1_Ancillary.zip"
    with requests.get(LANDFORMS_ZIP, stream=True, timeout=600, headers=HEADERS) as r:
        r.raise_for_status()
        with open(zpath, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        for member in z.namelist():  # refuse path traversal
            if member.startswith("/") or ".." in Path(member).parts:
                raise ValueError(f"unsafe path in zip: {member}")
        z.extractall(target)
    print("landforms:", sorted(p.name for p in target.rglob("*") if p.is_file()))


if __name__ == "__main__":
    layers = [a for a in sys.argv[2:] if a != "landforms"]
    main(Path(sys.argv[1]), layers or ["0_1"])
    if "landforms" in sys.argv[2:]:
        fetch_landforms(Path(sys.argv[1]))
