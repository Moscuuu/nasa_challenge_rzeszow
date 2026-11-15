"""Download the Global Permafrost Zonation Index (Gruber 2012, The Cryosphere 6, 221-233): PZI and the
mean annual air temperature it was built from. 30 arc-seconds, 90 N - 60 S, float32, 3.1 GB each. Public.

Usage: python pipeline/fetch_pzi.py data/raw/pzi
"""
import sys
from pathlib import Path

import requests

BASE = "https://www.geo.uzh.ch/microsite/cryodata/pf_global"
FILES = {"PZI.hdr": None, "MAAT_MEAN.hdr": None, "README.txt": None,
         "PZI.flt": 3_110_400_000, "MAAT_MEAN.flt": 3_110_400_000}  # expected size [bytes]


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, size in FILES.items():
        target = out_dir / name
        if target.exists() and (size is None or target.stat().st_size == size):
            print("skip", name)
            continue
        print("get", name, flush=True)
        with requests.get(f"{BASE}/{name}", stream=True, timeout=600) as r:
            r.raise_for_status()
            tmp = target.with_suffix(target.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 22):
                    f.write(chunk)
            tmp.replace(target)
        if size is not None and target.stat().st_size != size:
            raise SystemExit(f"{name}: got {target.stat().st_size} bytes, expected {size}")
        print("done", name, target.stat().st_size >> 20, "MB", flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
