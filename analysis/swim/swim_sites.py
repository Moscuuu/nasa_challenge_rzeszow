"""Mars target sites: one feature row per site from SWIM rasters (+ Phoenix from literature).

For each site, median over a +/-1 deg window of:
    ci_0_1, ci_1_5, ci_5   SWIM4MIM ice consistency at 0-1 m, 1-5 m, >5 m  (-1..+1)
    poly                   SWIM polygon landform occurrence (0..1); NaN poleward of +/-49 deg
Derived:
    ice_depth_m   representative depth of the shallowest layer with ci > ICE_C:
                  0-1 m -> 0.5, 1-5 m -> 2.5, >5 m -> 10 (NaN if none)
    ice_strength  max(ci over layers), clipped to 0..1

Phoenix lies north of SWIM (60N), so its row comes from literature (analysis/phoenix/):
ice table 2-18 cm (mean 4.6 cm), polygons everywhere, ice-cemented.

Output: data/swim/mars_sites.csv
Coordinates: planetocentric lat, east longitude in -180..180. Site centres are approximate
(region-level), the window median makes the profile data-driven.

Usage: python analysis/swim/swim_sites.py
Context: context/swim_for_agents.md
"""
import argparse
import time
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import tifffile  # not rasterio: on Windows rasterio crashes (access violation) once pandas is loaded

BASE = "https://swim.psi.edu/output/SWIM4MIM/Global"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"}
FILES = {
    "ci_0_1": "Composite/SWIM4MIM_Ci_0_1.tif",
    "ci_1_5": "Composite/SWIM4MIM_Ci_1_5.tif",
    "ci_5": "Composite/SWIM4MIM_Ci_5.tif",
}
POLY_ZIP = "Datasets/SWIM4MIM_G_0_1_Ancillary.zip"
POLY_MEMBER = "SWIM4MIM_G_0_1_Ancillary/SWIM4MIM_Polygons_GIS.tif"
POLY_LAT_MAX = 49.0
ICE_C = 0.3
DEPTH = {"ci_0_1": 0.5, "ci_1_5": 2.5, "ci_5": 10.0}
# SWIM global grid: 7200 x 2400, 0.05 deg, lon -180..180, lat 60..-60 (row 0 = 60N)
SHAPE, RES, LAT_TOP, LON_LEFT = (2400, 7200), 0.05, 60.0, -180.0
_cache: dict = {}

# id: (name, lat, lon_east, type, note)
SITES = {
    "phoenix": ("Phoenix landing site", 68.22, -125.7, "lander", "literature values, outside SWIM"),
    "arcadia_planitia": ("Arcadia Planitia", 42.5, -155.0, "ice target", "brine-window peak (team SWIM analysis)"),
    "erebus_montes": ("Erebus Montes", 38.5, -172.0, "ice target", "approx. centre"),
    "deuteronilus_mensae": ("Deuteronilus Mensae", 44.0, 23.0, "ice target", "debris aprons, approx. centre"),
    "utopia_scalloped": ("Utopia Planitia (scalloped terrain)", 45.0, 85.0, "ice target", "approx. centre"),
    "hellas_east_lda": ("Eastern Hellas (debris aprons)", -38.0, 104.0, "ice target", "approx. centre"),
    "zhurong": ("Zhurong landing site", 25.1, 109.9, "rover", "low-latitude contrast"),
}
PHOENIX = {"ci_0_1": 1.0, "ci_1_5": 1.0, "ci_5": np.nan, "poly": 1.0, "ice_depth_m": 0.046}


def download(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(8):
        try:
            pos = tmp.stat().st_size if tmp.exists() else 0
            hdr = dict(UA, **({"Range": f"bytes={pos}-"} if pos else {}))
            with requests.get(url, stream=True, timeout=60, headers=hdr) as r:
                r.raise_for_status()
                with open(tmp, "ab" if pos and r.status_code == 206 else "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            tmp.rename(dest)
            return dest
        except requests.RequestException as e:
            print(f"    retry {attempt + 1}: {e}", flush=True)
            time.sleep(3)
    raise RuntimeError(f"download failed: {url}")


def window(path: Path, lat: float, lon: float, half: float = 1.0) -> np.ndarray:
    if path not in _cache:
        a = tifffile.imread(path).astype(np.float64)
        assert a.shape == SHAPE, f"unexpected SWIM grid {a.shape} in {path}"
        _cache[path] = a
    a = _cache[path]
    r0 = max(int((LAT_TOP - (lat + half)) / RES), 0)
    r1 = max(int((LAT_TOP - (lat - half)) / RES), 0)
    c0 = max(int((lon - half - LON_LEFT) / RES), 0)
    c1 = max(int((lon + half - LON_LEFT) / RES), 0)
    w = a[r0:r1, c0:c1]
    bad = ~np.isfinite(w) | (w < -2) | (w > 1e30)  # nodata: -30, -3.4e38
    return np.where(bad, np.nan, w)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data/swim")
    args = ap.parse_args()
    d = Path(args.data)
    d.mkdir(parents=True, exist_ok=True)

    paths = {}
    for k, rel in FILES.items():
        print(f"{k}: {rel}", flush=True)
        paths[k] = download(f"{BASE}/{rel}", d / Path(rel).name)
    z = download(f"{BASE}/{POLY_ZIP}", d / Path(POLY_ZIP).name)
    poly_path = d / Path(POLY_MEMBER).name
    if not poly_path.exists():
        with zipfile.ZipFile(z) as zf, open(poly_path, "wb") as f:
            f.write(zf.read(POLY_MEMBER))
    paths["poly"] = poly_path

    rows = []
    for sid, (name, lat, lon, typ, note) in SITES.items():
        row = {"id": sid, "name": name, "lat": lat, "lon": lon, "type": typ, "note": note}
        if sid == "phoenix":
            row.update(PHOENIX)
        else:
            for k in FILES:
                row[k] = float(np.nanmedian(window(paths[k], lat, lon)))
            p = window(paths["poly"], lat, lon)
            row["poly"] = float(np.nanmedian(np.clip(p, 0, 1))) if abs(lat) <= POLY_LAT_MAX else np.nan
            row["ice_depth_m"] = next((DEPTH[k] for k in FILES if row[k] > ICE_C), np.nan)
        row["ice_strength"] = float(np.clip(np.nanmax([row[k] for k in FILES]), 0, 1))
        rows.append(row)

    df = pd.DataFrame(rows)
    out = d / "mars_sites.csv"
    df.round(3).to_csv(out, index=False)
    print(df.round(2).to_string(index=False))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
