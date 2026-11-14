"""Download ESA Permafrost CCI v5 PFR and ALT (2023) for the northern hemisphere and Antarctica.

Usage: python -I pipeline/fetch_cci.py data/raw/cci
"""
import sys
from pathlib import Path

import requests

BASE = "https://dap.ceda.ac.uk/neodc/esacci/permafrost/data"
YEAR = 2023
FILES = {
    ("permafrost_extent", "northern_hemisphere", "PFR", "AREA4"),
    ("permafrost_extent", "Antarctica", "PFR", "AREA27"),
    ("active_layer_thickness", "northern_hemisphere", "ALT", "AREA4"),
    ("active_layer_thickness", "Antarctica", "ALT", "AREA27"),
}


def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for product, hemi, var, area in sorted(FILES):
        name = f"ESACCI-PERMAFROST-L4-{var}-MODISLST_CRYOGRID-{area}_PP-{YEAR}-fv05.0.nc"
        url = f"{BASE}/{product}/L4/area4/pp/v05.0/{hemi}/{YEAR}/{name}"
        target = out_dir / name
        if target.exists() and target.stat().st_size > 0:
            print("skip", name)
            continue
        print("get", url, flush=True)
        with requests.get(url, stream=True, timeout=600) as r:
            r.raise_for_status()
            tmp = target.with_suffix(".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(target)
        print("done", name, target.stat().st_size // (1 << 20), "MB", flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
