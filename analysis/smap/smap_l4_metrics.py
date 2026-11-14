"""Per-pixel analog metrics from SMAP L4 (SPL4SMGP) region subsets made by smap_l4_fetch.py.

Metrics are chosen to compare with the Phoenix reference (analysis/phoenix/PHOENIX_WNIOSKI.md):
daily temperature range, no thaw, summer daily max/min, freeze-thaw activity, and soil dryness
(the filter against the "wet tundra" trap).

Usage:
    python smap_l4_metrics.py data/smap_l4/alaska_north.nc [more_region.nc ...] --out data/smap_l4/metrics

Output per region:
    <out>/<region>_metrics.nc    metric maps (y, x) with lat/lon
    <out>/<region>_metrics.csv   one row per 9 km pixel (land pixels only), easy to rank/join
    stdout                        region median of key metrics next to the Phoenix reference

Days are local solar days: each pixel's 3-hourly series is shifted by round(lon / 45 deg) * 3 h
before daily grouping, so a "day" runs roughly local midnight to midnight.
"Summer" = Jun-Aug for lat >= 0, Dec-Feb for lat < 0 (Phoenix data are late spring-summer only).

Caveats (state these when presenting results):
  * SPL4SMGP values are 3-hour AVERAGES, 8 per day: daily max/min and ranges are smoothed and
    underestimate true extremes.
  * surface_temp is land-surface (skin) temperature and soil_temp_layer1 is ~0-10 cm soil;
    Phoenix MET is AIR at 1 m. Compare derived metrics, not raw values 1:1.
  * L4 is model + SMAP brightness-temperature assimilation, not a direct retrieval.
  * Annualised counts assume the period covers whole seasons; use >= 1 full year.
"""
import argparse
import os
import sys

import numpy as np
import xarray as xr

T0 = 273.15  # K
TEMP_VARS = {
    "temp_lowatmmodlay": "tair",   # air, lowest model layer ~40-80 m
    "surface_temp": "tsurf",       # skin
    "soil_temp_layer1": "tsoil1",
    "soil_temp_layer2": "tsoil2",
    "soil_temp_layer3": "tsoil3",
    "soil_temp_layer4": "tsoil4",
}
# top depth (m) of SMAP L4 / Catchment soil heat layers (thicknesses 0.0988, 0.1952, 0.3859, 0.7626 m;
# verify against the SPL4SMGP product spec before quoting)
SOIL_LAYER_TOP_M = {"soil_temp_layer1": 0.0, "soil_temp_layer2": 0.0988,
                    "soil_temp_layer3": 0.294, "soil_temp_layer4": 0.6799}
MOIST_VARS = {"sm_surface": "sm_surf", "sm_rootzone": "sm_root", "sm_surface_wetness": "wet_surf",
              "land_fraction_snow_covered": "snow_frac"}
PRECIP_VAR = "precipitation_total_surface_flux"  # kg/m2/s

# Phoenix MET (air at 1 m, 143 full sols, late spring-summer), from PHOENIX_WNIOSKI.md section 2.3
PHOENIX_REF = {
    "daily_range_summer_K": 57.0,
    "daily_max_summer_K": 245.6,
    "daily_min_summer_K": 188.5,
    "frac_days_no_thaw": 1.0,
    "frac_below0": 1.0,
}


def expected_samples_per_day(time):
    days = time.to_series().dt.floor("D")
    return int(days.value_counts().max())


def local_daily(da, lon, min_samples):
    """Daily max/min per pixel on local solar days. da dims: (time, y, x); lon dims: (x,)."""
    offsets = np.round(lon / 45.0).astype(int)  # 45 deg of longitude = 3 h
    pieces, order = [], []
    for off in np.unique(offsets):
        idx = np.where(offsets == off)[0]
        sub = da.isel(x=idx)
        sub = sub.assign_coords(time=sub.time + np.timedelta64(int(off) * 3, "h"))
        r = sub.resample(time="1D")
        ok = r.count() >= min_samples  # drop partial days (period edges, gaps)
        pieces.append(xr.Dataset({"dmax": r.max().where(ok), "dmin": r.min().where(ok)}))
        order.append(idx)
    out = xr.concat(pieces, dim="x", join="outer")
    return out.isel(x=np.argsort(np.concatenate(order)))


def summer_mask(time, lat):
    month = time.dt.month
    return xr.where(lat >= 0, month.isin([6, 7, 8]), month.isin([12, 1, 2]))


def temp_metrics(da, lat, lon, min_samples, p):
    m = {}
    valid = da.notnull()
    m[f"{p}_mean_K"] = da.mean("time")
    m[f"{p}_min_K"] = da.min("time")
    m[f"{p}_max_K"] = da.max("time")
    m[f"{p}_frac_below0"] = (da < T0).where(valid).mean("time")

    d = local_daily(da, lon, min_samples)
    full = d.dmax.notnull()
    rng = d.dmax - d.dmin
    n_days = full.sum("time")
    m[f"{p}_n_full_days"] = n_days
    m[f"{p}_daily_range_mean_K"] = rng.mean("time")
    m[f"{p}_frac_days_no_thaw"] = (d.dmax < T0).where(full).mean("time")
    ft_days = ((d.dmin < T0) & (d.dmax > T0)).where(full).sum("time")
    m[f"{p}_ft_days_per_year"] = (ft_days / n_days.where(n_days > 0) * 365.25)

    s = summer_mask(d.time, lat) & full
    m[f"{p}_daily_range_summer_K"] = rng.where(s).mean("time")
    m[f"{p}_daily_max_summer_K"] = d.dmax.where(s).mean("time")
    m[f"{p}_daily_min_summer_K"] = d.dmin.where(s).mean("time")
    m[f"{p}_frac_summer_days_no_thaw"] = (d.dmax < T0).where(s).mean("time")
    return m


def moist_metrics(da, lat, p):
    s = summer_mask(da.time, lat)
    return {
        f"{p}_mean": da.mean("time"),
        f"{p}_p90": da.quantile(0.9, dim="time", skipna=True).drop_vars("quantile"),
        f"{p}_summer_mean": da.where(s).mean("time"),
    }


def process(path, out_dir, min_samples_arg):
    region = os.path.splitext(os.path.basename(path))[0]
    with xr.open_dataset(path, engine="h5netcdf") as src:
        ds = src.sortby("time")
        lat, lon = ds.lat.load(), ds.lon.load()
        min_samples = min_samples_arg or expected_samples_per_day(ds.time)
        t0, t1 = str(ds.time.values[0])[:10], str(ds.time.values[-1])[:10]
        print(f"\n== {region}: {ds.sizes['time']} steps {t0}..{t1}, grid {ds.sizes['y']}x{ds.sizes['x']}, "
              f"full day = {min_samples} samples")

        metrics = {}
        for v, p in TEMP_VARS.items():  # one variable in memory at a time
            if v in ds:
                metrics.update(temp_metrics(ds[v].load(), lat, lon, min_samples, p))
        for v, p in MOIST_VARS.items():
            if v in ds:
                metrics.update(moist_metrics(ds[v].load(), lat, p))
        if PRECIP_VAR in ds:
            metrics["precip_mm_per_year"] = ds[PRECIP_VAR].load().mean("time") * 86400 * 365.25
        # permafrost-table proxy: top depth of the shallowest soil layer that never rises above 0 C.
        # 0 = frozen from the surface, NaN = all available layers thaw at some point (or no data)
        frozen_top = None
        for v in sorted(SOIL_LAYER_TOP_M, key=SOIL_LAYER_TOP_M.get, reverse=True):
            key = f"{TEMP_VARS[v]}_max_K"
            if key in metrics:
                frozen = metrics[key] < T0
                base = frozen_top if frozen_top is not None else xr.full_like(metrics[key], np.nan)
                frozen_top = xr.where(frozen, SOIL_LAYER_TOP_M[v], base)
        if frozen_top is not None:
            metrics["frozen_below_m"] = frozen_top
        if not metrics:
            print(f"  ! no known variables in {path}", file=sys.stderr)
            return
        # counts/sums give 0 on all-NaN pixels (ice, water, masked); turn them into NaN everywhere
        has_data = None
        for v in [*TEMP_VARS, *MOIST_VARS, PRECIP_VAR]:
            if v in ds:
                hv = ds[v].notnull().any("time").load()
                has_data = hv if has_data is None else (has_data | hv)

    out = xr.Dataset({k: v.where(has_data).astype("float32") for k, v in metrics.items()},
                     coords={"lat": lat, "lon": lon})
    out.attrs.update(source="SPL4SMGP via smap_l4_fetch.py", period=f"{t0}..{t1}",
                     note="3-hourly averages; skin/soil temperature, not air. See script docstring.")
    os.makedirs(out_dir, exist_ok=True)
    nc_path = os.path.join(out_dir, f"{region}_metrics.nc")
    out.to_netcdf(nc_path, engine="h5netcdf")

    df = out.to_dataframe().reset_index()
    df = df.dropna(subset=list(metrics), how="all")  # drop water/ice/masked pixels
    df.insert(0, "region", region)
    csv_path = os.path.join(out_dir, f"{region}_metrics.csv")
    df.drop(columns=["y", "x"]).to_csv(csv_path, index=False, float_format="%.4f")

    print(f"  {len(df)} valid pixels -> {nc_path}, {csv_path}")
    prefixes = [p for p in TEMP_VARS.values() if f"{p}_mean_K" in out]
    print(f"  {'metric (region median)':28s}" + "".join(f"{p:>9s}" for p in prefixes) + f"{'Phoenix*':>9s}")
    for key, ref in PHOENIX_REF.items():
        vals = "".join(f"{float(out[f'{p}_{key}'].median()):9.3f}" for p in prefixes)
        print(f"  {key:28s}{vals}{ref:9.3f}")
    print(f"  {'ft_days_per_year':28s}" + "".join(f"{float(out[f'{p}_ft_days_per_year'].median()):9.1f}"
                                                  for p in prefixes) + f"{0:9.1f}")
    for k in ("frozen_below_m", "precip_mm_per_year", "sm_surf_mean", "sm_surf_summer_mean",
              "sm_root_mean", "snow_frac_summer_mean"):
        if k in out:
            print(f"  {k:28s}{float(out[k].median()):9.3f}")
    print("  * Phoenix = AIR at 1 m, real extremes (ice table 0.02-0.18 m, ~0 precip).")
    print("    SMAP = 3 h averages; tair at ~40-80 m, tsurf skin, tsoil soil. Compare trends, not 1:1.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="merged region files <out>/<region>.nc from smap_l4_fetch.py")
    ap.add_argument("--out", default="data/smap_l4/metrics", help="output dir (default data/smap_l4/metrics)")
    ap.add_argument("--min-samples", type=int, default=None,
                    help="samples needed for a full day (default: max samples seen per UTC day, 8 for full data)")
    args = ap.parse_args()
    for p in args.inputs:
        process(p, args.out, args.min_samples)


if __name__ == "__main__":
    main()
