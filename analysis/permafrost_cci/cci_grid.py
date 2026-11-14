"""ESA Permafrost_cci v5.0 -> 0.1 deg grid (same grid as the other layers).

Downloads one file per (product, region, year) from CEDA (public, no login), block-averages the
0.01 deg pixels into 0.1 deg cells (NaN-aware), averages over years, deletes the raw file.

Per cell output (data/permafrost_cci/cci_grid_0p1deg.csv.gz):
    lat, lon, GST, T1m, T10m (deg C, annual mean), ALT (m), PFR (%), land_frac (share of 0.01 deg
    pixels with GST data)

Years: default 2021-2023 (3-year mean; 2023 alone was a warm year, see context file).

Usage:
    python analysis/permafrost_cci/cci_grid.py
    python analysis/permafrost_cci/cci_grid.py --years 2023 --keep-raw
Context: context/permafrost_cci_for_agents.md
"""
import argparse
import time
from pathlib import Path

import h5netcdf
import numpy as np
import pandas as pd
import requests

ROOT = "https://dap.ceda.ac.uk/neodc/esacci/permafrost/data"
PRODUCTS = {  # folder, product code, variables
    "GTD": ("ground_temperature", ["GST", "T1m", "T10m"]),
    "ALT": ("active_layer_thickness", ["ALT"]),
    "PFR": ("permafrost_extent", ["PFR"]),
}
REGIONS = {"NH": ("northern_hemisphere", "AREA4"), "AA": ("Antarctica", "AREA27")}
STEP, NATIVE = 0.1, 0.01
F = int(round(STEP / NATIVE))  # 10x10 native pixels per cell


def url(prod: str, region: str, year: int) -> str:
    folder, _ = PRODUCTS[prod]
    rdir, area = REGIONS[region]
    src = "ERA5_MODISLST_BIASCORRECTED" if year < 2003 else "MODISLST_CRYOGRID"
    return (f"{ROOT}/{folder}/L4/area4/pp/v05.0/{rdir}/{year}/"
            f"ESACCI-PERMAFROST-L4-{prod}-{src}-{area}_PP-{year}-fv05.0.nc")


def download(u: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    tmp = dest.with_suffix(".part")
    for attempt in range(5):
        try:
            pos = tmp.stat().st_size if tmp.exists() else 0
            hdr = {"Range": f"bytes={pos}-"} if pos else {}
            with requests.get(u, stream=True, timeout=60, headers=hdr) as r:
                r.raise_for_status()
                with open(tmp, "ab" if pos else "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            tmp.rename(dest)
            return dest
        except requests.RequestException as e:
            print(f"    retry {attempt + 1}: {e}", flush=True)
            time.sleep(3)
    raise RuntimeError(f"download failed: {u}")


def read_var(ds, name: str, rows: slice) -> np.ndarray:
    """Read rows of a (time, lat, lon) variable, applying fill/scale/offset by hand."""
    v = ds.variables[name]
    a = v[0, rows, :]
    a = np.asarray(a, dtype=np.float64)
    att = v.attrs
    fill = att.get("_FillValue")
    if fill is not None:
        a[a == np.asarray(fill, dtype=np.float64)] = np.nan
    a = a * float(np.asarray(att.get("scale_factor", 1.0))) + float(np.asarray(att.get("add_offset", 0.0)))
    return a.astype(np.float32)


def block_mean(a: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w = a.shape
    b = a[: h // F * F, : w // F * F].reshape(h // F, F, w // F, F)
    ok = np.isfinite(b)
    n = ok.sum(axis=(1, 3))
    s = np.where(ok, b, 0).sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        return (s / n).astype(np.float32), (n / (F * F)).astype(np.float32)


def aggregate(path: Path, variables: list[str]) -> dict:
    """Return {var: 0.1deg array}, plus 'lat','lon' centres and '<var>_frac' coverage."""
    out = {}
    with h5netcdf.File(path, "r") as ds:
        lat = np.asarray(ds.variables["lat"][:], dtype=np.float64)
        lon = np.asarray(ds.variables["lon"][:], dtype=np.float64)
        nlat = len(lat) // F * F
        band = 200  # native rows per read (multiple of F)
        for v in variables:
            means, fracs = [], []
            for r0 in range(0, nlat, band):
                m, fr = block_mean(read_var(ds, v, slice(r0, min(r0 + band, nlat))))
                means.append(m)
                fracs.append(fr)
            out[v] = np.vstack(means)
            out[v + "_frac"] = np.vstack(fracs)
        out["lat"] = lat[:nlat].reshape(-1, F).mean(axis=1)
        out["lon"] = lon[: len(lon) // F * F].reshape(-1, F).mean(axis=1)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=[2021, 2022, 2023])
    ap.add_argument("--raw", default="data/permafrost_cci/raw")
    ap.add_argument("--out", default="data/permafrost_cci")
    ap.add_argument("--keep-raw", action="store_true")
    args = ap.parse_args()
    raw, out = Path(args.raw), Path(args.out)
    raw.mkdir(parents=True, exist_ok=True)

    tables = []
    for region in REGIONS:
        acc: dict[str, list] = {}
        grid = None
        for prod, (_, variables) in PRODUCTS.items():
            for y in args.years:
                u = url(prod, region, y)
                dest = raw / Path(u).name
                print(f"{region} {prod} {y}: download ...", flush=True)
                download(u, dest)
                g = aggregate(dest, variables)
                if not args.keep_raw:
                    dest.unlink()
                grid = grid or {"lat": g["lat"], "lon": g["lon"]}
                for v in variables:
                    acc.setdefault(v, []).append(g[v])
                if prod == "GTD":
                    acc.setdefault("land_frac", []).append(g["GST_frac"])
                print(f"    -> {variables} cells with data: {np.isfinite(g[variables[0]]).sum()}", flush=True)
        LON, LAT = np.meshgrid(grid["lon"], grid["lat"])
        df = pd.DataFrame({"lat": LAT.ravel().round(2), "lon": LON.ravel().round(2)})
        for v, arrs in acc.items():
            with np.errstate(invalid="ignore"):
                df[v] = np.nanmean(np.stack(arrs), axis=0).ravel()
        df = df[df["GST"].notna() | df["PFR"].notna()]
        df["region"] = region
        tables.append(df)

    res = pd.concat(tables, ignore_index=True)
    # snap to the shared grid centres (x.x5)
    res["lat"] = (np.floor(res["lat"] / STEP) * STEP + STEP / 2).round(2)
    res["lon"] = (np.floor(res["lon"] / STEP) * STEP + STEP / 2).round(2)
    res.attrs = {}
    fn = out / "cci_grid_0p1deg.csv.gz"
    res.round(3).to_csv(fn, index=False)
    print(f"grid: {len(res)} cells -> {fn}  (years {args.years})")
    print(res.groupby("region")[["GST", "ALT", "PFR"]].describe().T.round(2).to_string())


if __name__ == "__main__":
    main()
