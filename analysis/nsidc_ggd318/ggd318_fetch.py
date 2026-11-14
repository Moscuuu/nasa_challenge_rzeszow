"""Download NSIDC GGD318 v2: Circum-Arctic Map of Permafrost and Ground-Ice Conditions.

Brown, J., Ferrians, O., Heginbottom, J. A. & Melnikov, E. (2002). Circum-Arctic Map of
Permafrost and Ground-Ice Conditions, Version 2. NSIDC. https://doi.org/10.7265/skbg-kf16

Small dataset (~23 MB), so we just download the whole thing.

Auth: NASA Earthdata Login. requests picks up ~/.netrc (Windows: ~/_netrc) entry for
urs.earthdata.nasa.gov automatically when NSIDC redirects there; EARTHDATA_USERNAME /
EARTHDATA_PASSWORD env vars are used as fallback.

Usage:
    pip install requests
    python ggd318_fetch.py --out data/nsidc_ggd318
"""
import argparse
import os
import sys
from pathlib import Path

import requests

BASE = "https://daacdata.apps.nsidc.org/pub/DATASETS/fgdc/ggd318_map_circumarctic"
FILES = [
    "README.txt",
    # vector map: permafrost extent + ground ice content + landform per polygon
    "permaice.shp", "permaice.shx", "permaice.dbf", "permaice.prj", "permaice.avl",
    # same classes rasterised on a 12.5 km polar LAEA grid (codes 1-25, = NUM_CODE)
    "nhipa.byte", "nhipa.hdr",
    # offshore (subsea) permafrost, not used in the analysis but tiny
    "subsea.shp", "subsea.shx", "subsea.dbf", "subsea.prj",
]


class EarthdataSession(requests.Session):
    """Keep env-var credentials across the NSIDC -> urs.earthdata.nasa.gov redirect."""

    def __init__(self):
        super().__init__()
        user, pw = os.environ.get("EARTHDATA_USERNAME"), os.environ.get("EARTHDATA_PASSWORD")
        self._env_auth = (user, pw) if user and pw else None

    def rebuild_auth(self, prepared_request, response):
        super().rebuild_auth(prepared_request, response)  # netrc lookup for the new host
        if self._env_auth and "urs.earthdata.nasa.gov" in prepared_request.url \
                and "Authorization" not in prepared_request.headers:
            prepared_request.prepare_auth(self._env_auth)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data/nsidc_ggd318")
    ap.add_argument("--force", action="store_true", help="re-download existing files")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    s = EarthdataSession()
    for name in FILES:
        dst = out / name
        if dst.exists() and dst.stat().st_size > 0 and not args.force:
            print(f"skip {name} (exists)")
            continue
        r = s.get(f"{BASE}/{name}", timeout=300)
        # a failed login lands on an HTML page with status 200, so check the content type too
        if r.status_code != 200 or r.headers.get("Content-Type", "").startswith("text/html"):
            sys.exit(f"download failed for {name} ({r.status_code}). "
                     "Check Earthdata credentials in ~/_netrc or EARTHDATA_USERNAME/PASSWORD.")
        dst.write_bytes(r.content)
        print(f"ok   {name} ({len(r.content) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
