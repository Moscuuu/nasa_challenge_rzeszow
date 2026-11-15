"""Download TES global albedo (Christensen 2001) and Putzig & Mellon 2007 night-time thermal inertia.

Usage: python pipeline/fetch_tes.py data/raw/tes
"""
import sys
from pathlib import Path

import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
ALB = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-special-v1"
TI = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data"
FILES = [
    f"{ALB}/global_albedo_8ppd.img",
    f"{ALB}/global_albedo_8ppd.lbl",
    f"{TI}/GLOBAL_TI_NIGHT_2007.IMG",
    f"{TI}/GLOBAL_TI_NIGHT_2007.LBL",
    f"{TI}/GLOBAL_TI_MSK_NIGHT_2007.IMG",
    f"{TI}/GLOBAL_TI_MSK_NIGHT_2007.LBL",
]


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for url in FILES:
        name = url.rsplit("/", 1)[1]
        target = out_dir / name
        if target.exists() and target.stat().st_size > 0:
            print("skip", name)
            continue
        print("get", name, flush=True)
        with requests.get(url, stream=True, timeout=600, headers=HEADERS) as r:
            r.raise_for_status()
            tmp = target.with_suffix(target.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(target)
        print("done", name, target.stat().st_size >> 10, "KB", flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
