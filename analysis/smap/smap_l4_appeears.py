"""Fetch SMAP L4 SPL4SMGP region subsets via NASA AppEEARS (server-side subsetting).

Unlike smap_l4_fetch.py (downloads ~140 MB global granules, ~400 GB/year), AppEEARS cuts the
region on NASA's side, so only the region's pixels are downloaded (MBs to ~1 GB).

Flow per region: submit AppEEARS "area" task -> poll until done -> download NetCDF ->
normalise to the same layout as smap_l4_fetch.py -> <out>/<region>.nc
so smap_l4_metrics.py works unchanged. Task ids are saved in <out>/appeears_tasks.json;
re-running the same command resumes (no duplicate tasks, no re-download).

Auth: NASA Earthdata Login. Reads EARTHDATA_USERNAME / EARTHDATA_PASSWORD, else ~/.netrc
(Windows: ~/_netrc) entry for urs.earthdata.nasa.gov, else prompts.

Usage:
    pip install requests xarray h5netcdf numpy

    # small test first: 3 days, check the printed time steps per day (expect 8)
    python smap_l4_appeears.py --start 2023-07-01 --end 2023-07-03 \
        --region dry_valleys:160.5,-78,163,-77.2 --out data/smap_l4_test

    python smap_l4_appeears.py --start 2023-01-01 --end 2023-12-31 \
        --region alaska_north:-165,68,-140,72 --region qiangtang:82,33,90,36 --out data/smap_l4

    python smap_l4_metrics.py data/smap_l4/alaska_north.nc data/smap_l4/qiangtang.nc

Region format: NAME:lon_min,lat_min,lon_max,lat_max (degrees, no antimeridian crossing).
"""
import argparse
import getpass
import json
import netrc
import os
import sys
import time
from datetime import date

import numpy as np
import requests
import xarray as xr

API = "https://appeears.earthdatacloud.nasa.gov/api"
PRODUCT = "SPL4SMGP.008"
PREFIX = "Geophysical_Data_"
DEFAULT_LAYERS = [
    # temperature (factor 3) and frozen ground with depth (factor 4)
    "temp_lowatmmodlay",   # air temperature, lowest model layer (~40-80 m): closest to Phoenix MET air temp
    "surface_temp",        # land surface (skin) temperature
    "soil_temp_layer1",    # ~0-0.10 m
    "soil_temp_layer2",    # ~0.10-0.29 m  (Phoenix ice table: 0.02-0.18 m)
    "soil_temp_layer3",    # ~0.29-0.68 m
    "soil_temp_layer4",    # ~0.68-1.44 m
    # dryness: Phoenix soil is dry over ice; filters out wet tundra
    "sm_surface",          # 0-5 cm soil moisture, m3/m3
    "sm_rootzone",         # 0-100 cm soil moisture, m3/m3
    "sm_surface_wetness",  # surface moisture as fraction of saturation
    "precipitation_total_surface_flux",  # rain + snowfall, kg/m2/s (hyperarid filter)
    "land_fraction_snow_covered",        # snow cover insulates ground; Phoenix-like sites are mostly snow-free
]
STATE_FILE = "appeears_tasks.json"


def parse_region(s):
    try:
        name, coords = s.split(":")
        lon0, lat0, lon1, lat1 = map(float, coords.split(","))
    except ValueError:
        raise argparse.ArgumentTypeError(f"bad region '{s}', want NAME:lon_min,lat_min,lon_max,lat_max")
    if lon0 >= lon1 or lat0 >= lat1:
        raise argparse.ArgumentTypeError(f"region '{name}': min must be < max (antimeridian not supported)")
    return name, (lon0, lat0, lon1, lat1)


def credentials():
    user, pw = os.environ.get("EARTHDATA_USERNAME"), os.environ.get("EARTHDATA_PASSWORD")
    if user and pw:
        return user, pw
    for fn in ("~/.netrc", "~/_netrc"):  # stdlib netrc only checks .netrc; Windows convention is _netrc
        path = os.path.expanduser(fn)
        if not os.path.exists(path):
            continue
        try:
            auth = netrc.netrc(path).authenticators("urs.earthdata.nasa.gov")
            if auth:
                return auth[0], auth[2]
        except netrc.NetrcParseError as e:
            print(f"! cannot parse {path}: {e}", file=sys.stderr)
    return input("Earthdata username: "), getpass.getpass("Earthdata password: ")


def login():
    r = requests.post(f"{API}/login", auth=credentials(), timeout=60)
    if r.status_code != 200:
        sys.exit(f"AppEEARS login failed ({r.status_code}): {r.text[:300]}")
    return {"Authorization": f"Bearer {r.json()['token']}"}


def task_payload(name, bbox, start, end, layers):
    lon0, lat0, lon1, lat1 = bbox
    ring = [[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]
    return {
        "task_type": "area",
        "task_name": f"smap_l4_{name}_{start}_{end}",
        "params": {
            "dates": [{"startDate": start.strftime("%m-%d-%Y"), "endDate": end.strftime("%m-%d-%Y")}],
            "layers": [{"product": PRODUCT, "layer": PREFIX + l} for l in layers],
            "output": {"format": {"type": "netcdf4"}, "projection": "geographic"},
            "geo": {
                "type": "FeatureCollection",
                "features": [{"type": "Feature", "properties": {"name": name},
                              "geometry": {"type": "Polygon", "coordinates": [ring]}}],
            },
        },
    }


def load_state(out):
    p = os.path.join(out, STATE_FILE)
    return json.load(open(p)) if os.path.exists(p) else {}


def save_state(out, state):
    with open(os.path.join(out, STATE_FILE), "w") as f:
        json.dump(state, f, indent=1)


def submit(headers, payload):
    r = requests.post(f"{API}/task", json=payload, headers=headers, timeout=120)
    if r.status_code not in (200, 202):
        sys.exit(f"task submit failed ({r.status_code}): {r.text[:500]}")
    return r.json()["task_id"]


def task_info(headers, task_id):
    r = requests.get(f"{API}/task/{task_id}", headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()


def download_bundle(headers, task_id, dest):
    os.makedirs(dest, exist_ok=True)
    r = requests.get(f"{API}/bundle/{task_id}", headers=headers, timeout=60)
    r.raise_for_status()
    paths = []
    for f in r.json()["files"]:
        if not f["file_name"].endswith(".nc"):
            continue  # skip README / granule lists / xml
        p = os.path.join(dest, os.path.basename(f["file_name"]))
        if not (os.path.exists(p) and os.path.getsize(p) == f.get("file_size", -1)):
            with requests.get(f"{API}/bundle/{task_id}/{f['file_id']}", headers=headers,
                              stream=True, allow_redirects=True, timeout=600) as d:
                d.raise_for_status()
                with open(p + ".part", "wb") as fh:
                    for chunk in d.iter_content(1 << 20):
                        fh.write(chunk)
            os.replace(p + ".part", p)
        paths.append(p)
        print(f"  got {os.path.basename(p)} ({os.path.getsize(p) / 1e6:.1f} MB)")
    return paths


def _find(names, candidates):
    for c in candidates:
        if c in names:
            return c
    return None


def normalise(nc_paths, out_path, bbox):
    """AppEEARS NetCDF -> layout of smap_l4_fetch.py: vars (time, y, x), coords lat(y), lon(x)."""
    parts = []
    for p in nc_paths:
        with xr.open_dataset(p, engine="h5netcdf") as ds:
            parts.append(ds.load())
    ds = xr.merge(parts, compat="override", combine_attrs="drop_conflicts")
    names = set(ds.variables) | set(ds.dims)
    lat = _find(names, ["lat", "latitude", "y"])
    lon = _find(names, ["lon", "longitude", "x"])
    if lat is None or lon is None or "time" not in ds.dims:
        sys.exit(f"unexpected AppEEARS NetCDF layout, inspect it: {nc_paths}\n{ds}")

    keep = {v: v[len(PREFIX):] if v.startswith(PREFIX) else v
            for v in ds.data_vars if ds[v].dims == ("time", lat, lon)}
    out = ds[list(keep)].rename(keep)
    out = out.rename({lat: "y", lon: "x"}) if lat != "y" else out
    out = out.assign_coords(lat=("y", ds[lat].values.astype("float32")),
                            lon=("x", ds[lon].values.astype("float32")))
    out = out.drop_vars([c for c in ("y", "x") if c in out.coords])
    for v in out.data_vars:  # safety: fill values still raw
        out[v] = out[v].where(out[v] > -9999).astype("float32")
    out = out.sortby("time")
    out.attrs = {"source": f"{PRODUCT} via AppEEARS", "bbox": str(bbox)}

    per_day = out.time.to_series().dt.floor("D").value_counts()
    print(f"  {out.sizes['time']} time steps, {int(per_day.median())} per day (expect 8 for 3-hourly), "
          f"grid {out.sizes['y']}x{out.sizes['x']}, vars: {', '.join(out.data_vars)}")
    empty = [v for v in out.data_vars if not out[v].notnull().any()]
    if empty:
        print(f"  ! all-NaN (masked: ice/water?): {', '.join(empty)}", file=sys.stderr)
    enc = {v: {"zlib": True, "complevel": 4} for v in out.data_vars}
    out.to_netcdf(out_path, engine="h5netcdf", encoding=enc)
    print(f"  -> {out_path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", required=True, type=date.fromisoformat, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, type=date.fromisoformat, help="YYYY-MM-DD (inclusive)")
    ap.add_argument("--region", required=True, action="append", type=parse_region,
                    help="NAME:lon_min,lat_min,lon_max,lat_max (repeatable)")
    ap.add_argument("--out", default="data/smap_l4", help="output dir (default data/smap_l4)")
    ap.add_argument("--layers", default=",".join(DEFAULT_LAYERS),
                    help="comma-separated SPL4SMGP layers without the Geophysical_Data_ prefix")
    ap.add_argument("--poll", type=int, default=60, help="seconds between status checks")
    ap.add_argument("--no-wait", action="store_true", help="submit tasks and exit; re-run later to download")
    ap.add_argument("--dry-run", action="store_true", help="print task JSON, submit nothing")
    args = ap.parse_args()

    layers = [l.strip() for l in args.layers.split(",") if l.strip()]
    names = [n for n, _ in args.region]
    if len(set(names)) != len(names):
        sys.exit("region names must be unique")
    payloads = {n: task_payload(n, b, args.start, args.end, layers) for n, b in args.region}
    if args.dry_run:
        print(json.dumps(payloads, indent=1))
        return

    os.makedirs(args.out, exist_ok=True)
    state = load_state(args.out)
    done_or_empty = lambda n: any(os.path.exists(os.path.join(args.out, f"{n}{ext}")) for ext in (".nc", ".empty"))
    for n, _ in args.region:
        if os.path.exists(os.path.join(args.out, f"{n}.empty")):
            print(f"{n}: previous task returned no data (see {n}.empty); delete that file to retry")
    todo = [(n, b) for n, b in args.region if not done_or_empty(n)]
    if not todo:
        print("all regions already done")
        return
    headers = login()

    for n, _ in todo:  # submit (or reuse task with identical request)
        s = state.get(n)
        if s and s["payload"] == payloads[n]:
            print(f"{n}: reusing task {s['task_id']}")
            continue
        tid = submit(headers, payloads[n])
        state[n] = {"task_id": tid, "payload": payloads[n]}
        save_state(args.out, state)
        print(f"{n}: submitted task {tid}")
    if args.no_wait:
        print("submitted; re-run the same command later to download")
        return

    pending = dict(todo)
    while pending:
        for n in list(pending):
            tid = state[n]["task_id"]
            info = task_info(headers, tid)
            st = info.get("status")
            summary = info.get("summary") or {}
            if st == "done" and summary.get("empty"):
                # e.g. Antarctica: SPL4SMGP excludes permanent ice -> all fill values, no output files
                msg = summary.get("description", "no output files")
                print(f"{n}: done but EMPTY: {msg}", file=sys.stderr)
                with open(os.path.join(args.out, f"{n}.empty"), "w") as fh:
                    fh.write(f"task {tid}: {msg}\n")
                pending.pop(n)
            elif st == "done":
                print(f"{n}: done, downloading")
                paths = download_bundle(headers, tid, os.path.join(args.out, "appeears_raw", n))
                normalise(paths, os.path.join(args.out, f"{n}.nc"), pending.pop(n))
            elif st in ("error", "expired", "deleted"):
                print(f"{n}: task {tid} status '{st}', dropping from state; re-run to resubmit", file=sys.stderr)
                state.pop(n)
                save_state(args.out, state)
                pending.pop(n)
            else:
                print(f"{n}: {st}")
        if pending:
            time.sleep(args.poll)


if __name__ == "__main__":
    main()
