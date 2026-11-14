"""Download SMAP L4 SPL4SMGP (3-hourly, 9 km EASE-Grid 2.0) and keep only region subsets.

SPL4SMGP granules are global (~140 MB each, 8 per day), so this script works day by day:
download the day's granules to a temp dir -> cut out each region -> save a small NetCDF ->
delete the raw HDF5. Re-running skips granules already subset (resumable).

Auth: NASA Earthdata Login (https://urs.earthdata.nasa.gov). earthaccess reads, in order,
EARTHDATA_USERNAME / EARTHDATA_PASSWORD env vars, ~/.netrc (Windows: ~/_netrc), or prompts.

Usage:
    pip install earthaccess h5py numpy xarray h5netcdf

    # check granule count + download volume first (no login needed)
    python smap_l4_fetch.py --start 2023-01-01 --end 2023-01-31 \
        --region alaska_north:-165,68,-140,72 --dry-run

    python smap_l4_fetch.py --start 2023-01-01 --end 2023-01-31 \
        --region alaska_north:-165,68,-140,72 \
        --region tibet_qiangtang:82,33,90,36 \
        --out data/smap_l4

Output:
    <out>/<region>/<granule>.nc      one file per 3-hourly granule (resume markers)
    <out>/<region>.nc                all granules merged along time

Region format: NAME:lon_min,lat_min,lon_max,lat_max (degrees; no antimeridian crossing).
Units: soil moisture m3/m3, temperatures K, wetness 0-1. Fill values (-9999) -> NaN.
"""
import argparse
import os
import re
import shutil
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime

import h5py
import numpy as np
import xarray as xr

SHORT_NAME = "SPL4SMGP"
GROUP = "Geophysical_Data"
DEFAULT_VARS = [  # keep in sync with smap_l4_appeears.py DEFAULT_LAYERS
    "temp_lowatmmodlay",    # air temperature, lowest model layer (~40-80 m)
    "surface_temp",         # land surface (skin) temperature
    "soil_temp_layer1",     # ~0-0.10 m
    "soil_temp_layer2",     # ~0.10-0.29 m
    "soil_temp_layer3",     # ~0.29-0.68 m
    "soil_temp_layer4",     # ~0.68-1.44 m
    "sm_surface",           # 0-5 cm soil moisture
    "sm_rootzone",          # 0-100 cm soil moisture
    "sm_surface_wetness",   # surface moisture as fraction of saturation
    "precipitation_total_surface_flux",  # rain + snowfall, kg/m2/s
    "land_fraction_snow_covered",
]
# e.g. SMAP_L4_SM_gph_20230101T013000_Vv7032_001.h5
NAME_RE = re.compile(r"_(\d{8}T\d{6})_(Vv\d+)_")


def parse_region(s):
    try:
        name, coords = s.split(":")
        lon0, lat0, lon1, lat1 = map(float, coords.split(","))
    except ValueError:
        raise argparse.ArgumentTypeError(f"bad region '{s}', want NAME:lon_min,lat_min,lon_max,lat_max")
    if lon0 >= lon1 or lat0 >= lat1:
        raise argparse.ArgumentTypeError(f"region '{name}': min must be < max (antimeridian not supported)")
    return name, (lon0, lat0, lon1, lat1)


def granule_name(g):
    return g["umm"]["GranuleUR"]


def granule_time(name):
    m = NAME_RE.search(name)
    return datetime.strptime(m.group(1), "%Y%m%dT%H%M%S") if m else None


def latest_versions(granules):
    """CMR may return several product versions; keep the highest version per timestamp."""
    best = {}
    for g in granules:
        m = NAME_RE.search(granule_name(g))
        if not m:
            continue
        ts, ver = m.groups()
        if ts not in best or ver > NAME_RE.search(granule_name(best[ts])).group(2):
            best[ts] = g
    return [best[k] for k in sorted(best)]


def region_slices(lat1d, lon1d, bbox):
    lon0, lat0, lon1, lat1 = bbox
    rows = np.where((lat1d >= lat0) & (lat1d <= lat1))[0]
    cols = np.where((lon1d >= lon0) & (lon1d <= lon1))[0]
    if rows.size == 0 or cols.size == 0:
        return None
    return slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)


def subset_granule(h5_path, regions, variables, out_dir, t):
    stem = os.path.splitext(os.path.basename(h5_path))[0]
    with h5py.File(h5_path, "r") as f:
        # EASE-Grid 2.0 is regular in row/col: lat depends on row only, lon on column only
        lat1d = f["cell_lat"][:, 0]
        lon1d = f["cell_lon"][0, :]
        grp = f[GROUP]
        for name, bbox in regions:
            sl = region_slices(lat1d, lon1d, bbox)
            if sl is None:
                print(f"  ! region {name} has no 9 km cells, skipped", file=sys.stderr)
                continue
            rs, cs = sl
            data_vars = {}
            for v in variables:
                if v not in grp:
                    print(f"  ! variable {v} not in file, skipped", file=sys.stderr)
                    continue
                ds = grp[v]
                arr = ds[rs, cs].astype("float32")
                fill = ds.attrs.get("_FillValue", -9999.0)
                arr[(arr == fill) | (arr <= -9999)] = np.nan
                attrs = {k: (ds.attrs[k].decode() if isinstance(ds.attrs[k], bytes) else ds.attrs[k])
                         for k in ("units", "long_name") if k in ds.attrs}
                data_vars[v] = (("time", "y", "x"), arr[np.newaxis], attrs)
            out = xr.Dataset(
                data_vars,
                coords={
                    "time": [np.datetime64(t)],
                    "lat": ("y", lat1d[rs].astype("float32")),
                    "lon": ("x", lon1d[cs].astype("float32")),
                },
                attrs={"source": SHORT_NAME, "granule": stem, "bbox": str(bbox)},
            )
            dest = os.path.join(out_dir, name)
            os.makedirs(dest, exist_ok=True)
            enc = {v: {"zlib": True, "complevel": 4} for v in data_vars}
            out.to_netcdf(os.path.join(dest, stem + ".nc"), engine="h5netcdf", encoding=enc)


def merge_region(out_dir, name):
    d = os.path.join(out_dir, name)
    files = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".nc"))
    if not files:
        return
    parts = []
    for p in files:  # subsets are small: load eagerly, no dask needed
        with xr.open_dataset(p, engine="h5netcdf") as part:
            parts.append(part.load())
    ds = xr.concat(parts, dim="time", data_vars="minimal", coords="minimal", compat="override",
                   combine_attrs="drop_conflicts").sortby("time")
    enc = {v: {"zlib": True, "complevel": 4} for v in ds.data_vars}
    ds.to_netcdf(os.path.join(out_dir, name + ".nc"), engine="h5netcdf", encoding=enc)
    print(f"merged {len(files)} granules -> {os.path.join(out_dir, name + '.nc')}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", required=True, type=date.fromisoformat, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, type=date.fromisoformat, help="YYYY-MM-DD (inclusive)")
    ap.add_argument("--region", required=True, action="append", type=parse_region,
                    help="NAME:lon_min,lat_min,lon_max,lat_max (repeatable)")
    ap.add_argument("--out", default="data/smap_l4", help="output dir (default data/smap_l4)")
    ap.add_argument("--vars", default=",".join(DEFAULT_VARS), help="comma-separated Geophysical_Data vars")
    ap.add_argument("--hours", default=None,
                    help="keep only these UTC hours, e.g. 1,13 (granules at 01:30,04:30,...,22:30). Default all 8")
    ap.add_argument("--threads", type=int, default=4, help="parallel downloads per day")
    ap.add_argument("--keep-raw", action="store_true", help="keep downloaded HDF5 files in <out>/raw")
    ap.add_argument("--dry-run", action="store_true", help="only list granule count and size")
    ap.add_argument("--no-merge", action="store_true", help="skip writing merged <region>.nc")
    args = ap.parse_args()

    import earthaccess

    variables = [v.strip() for v in args.vars.split(",") if v.strip()]
    hours = {int(h) for h in args.hours.split(",")} if args.hours else None
    names = [n for n, _ in args.region]
    if len(set(names)) != len(names):
        sys.exit("region names must be unique")

    print(f"searching CMR for {SHORT_NAME} {args.start} .. {args.end}")
    results = earthaccess.search_data(
        short_name=SHORT_NAME,
        temporal=(f"{args.start}T00:00:00", f"{args.end}T23:59:59"),
        count=-1,
    )
    granules = []
    for g in latest_versions(results):
        t = granule_time(granule_name(g))
        if t and args.start <= t.date() <= args.end and (hours is None or t.hour in hours):
            granules.append(g)
    total_mb = sum(float(g["size"]) for g in granules)  # MB, set by earthaccess at search time
    print(f"{len(granules)} granules, ~{total_mb / 1024:.1f} GB to download (subsets are far smaller)")
    if args.dry_run or not granules:
        return

    earthaccess.login()
    os.makedirs(args.out, exist_ok=True)

    def done(g):
        stem = os.path.splitext(granule_name(g))[0]
        return all(os.path.exists(os.path.join(args.out, n, stem + ".nc")) for n in names)

    by_day = defaultdict(list)
    for g in granules:
        if not done(g):
            by_day[granule_time(granule_name(g)).date()].append(g)
    skipped = len(granules) - sum(map(len, by_day.values()))
    if skipped:
        print(f"skipping {skipped} granules already subset")

    for i, day in enumerate(sorted(by_day), 1):
        day_granules = by_day[day]
        print(f"[{i}/{len(by_day)}] {day}: {len(day_granules)} granules")
        tmp = os.path.join(args.out, "raw") if args.keep_raw else tempfile.mkdtemp(prefix="spl4smgp_")
        try:
            paths = earthaccess.download(day_granules, local_path=tmp, threads=args.threads)
            for p in paths:
                p = str(p)
                t = granule_time(os.path.basename(p))
                if t is None or not p.endswith(".h5"):
                    continue
                try:
                    subset_granule(p, args.region, variables, args.out, t)
                except OSError as e:  # truncated/corrupt download: leave for next run
                    print(f"  ! failed to read {os.path.basename(p)}: {e}", file=sys.stderr)
        finally:
            if not args.keep_raw:
                shutil.rmtree(tmp, ignore_errors=True)

    if not args.no_merge:
        for n in names:
            merge_region(args.out, n)


if __name__ == "__main__":
    main()
