"""Aggregate ESA Permafrost CCI v5 (0.01 deg) to the global 0.1 deg grid.

Grid: 1800 x 3600, row 0 = 90..89.9 N, col 0 = -180..-179.9 (same as fetch_era5.py).
Output data/interim/earth_grid.npz:
  pfr          mean permafrost fraction in the cell [0..1]
  alt          mean active-layer thickness over permafrost pixels [m]
  shallow_ice  mean of PFR * clip(1 - ALT/1 m, 0, 1) over the cell ("shallow ice certainty", 0..1)
  permafrost   bool mask: cell counts as permafrost (pfr >= PFR_MIN)

Usage: python -I pipeline/earth_grid.py data/raw/cci data/interim/earth_grid.npz
"""
import sys
from pathlib import Path

import netCDF4
import numpy as np

NX, NY, RES = 3600, 1800, 0.1
PFR_MIN = 0.10  # cells below 10 % permafrost ("isolated") are not counted as permafrost
FILES = {
    "N": ("ESACCI-PERMAFROST-L4-PFR-MODISLST_CRYOGRID-AREA4_PP-2023-fv05.0.nc",
          "ESACCI-PERMAFROST-L4-ALT-MODISLST_CRYOGRID-AREA4_PP-2023-fv05.0.nc"),
    "S": ("ESACCI-PERMAFROST-L4-PFR-MODISLST_CRYOGRID-AREA27_PP-2023-fv05.0.nc",
          "ESACCI-PERMAFROST-L4-ALT-MODISLST_CRYOGRID-AREA27_PP-2023-fv05.0.nc"),
}
STRIPE = 500  # fine rows per read (multiple of 10)


def block_mean(values: np.ndarray, valid: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean over 10x10 blocks of valid pixels; returns (mean, valid_count)."""
    r, c = values.shape
    v = np.where(valid, values, 0.0).reshape(r // 10, 10, c // 10, 10)
    n = valid.reshape(r // 10, 10, c // 10, 10).sum(axis=(1, 3))
    s = v.sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(n > 0, s / n, np.nan), n


def process(raw: Path, pfr_name: str, alt_name: str, out: dict) -> None:
    dp, da = netCDF4.Dataset(raw / pfr_name), netCDF4.Dataset(raw / alt_name)
    lat = np.asarray(dp["lat"][:], dtype=np.float64)
    ascending = lat[1] > lat[0]
    lat0 = lat[0] - 0.005 if ascending else lat[0] + 0.005  # edge of first fine row
    nrows = lat.size
    for r0 in range(0, nrows, STRIPE):
        r1 = min(r0 + STRIPE, nrows)
        pfr = dp["PFR"][0, r0:r1, :]
        alt = da["ALT"][0, r0:r1, :]
        pfr_valid = ~np.ma.getmaskarray(pfr)
        pfr_v = np.ma.getdata(pfr).astype(np.float64) / 100.0
        alt_valid = ~np.ma.getmaskarray(alt) & pfr_valid & (pfr_v > 0)
        alt_v = np.ma.getdata(alt).astype(np.float64)
        ice_v = np.where(alt_valid, pfr_v * np.clip(1.0 - alt_v, 0.0, 1.0), 0.0)

        pfr_m, _ = block_mean(pfr_v, pfr_valid)
        alt_m, _ = block_mean(alt_v, alt_valid)
        ice_m, _ = block_mean(ice_v, pfr_valid)

        # map coarse rows to global grid rows (row 0 = 90 N)
        k = np.arange(pfr_m.shape[0])
        edge = lat0 + (r0 / 10 + k) * (0.1 if ascending else -0.1)
        centre = edge + (0.05 if ascending else -0.05)
        rows = np.floor((90.0 - centre) / RES).astype(int)
        for name, arr in (("pfr", pfr_m), ("alt", alt_m), ("shallow_ice", ice_m)):
            out[name][rows] = np.where(np.isnan(arr), out[name][rows], arr)
        print(pfr_name[21:24], r0, r1, flush=True)
    dp.close()
    da.close()


def main(raw: Path, out_path: Path) -> None:
    out = {k: np.full((NY, NX), np.nan, dtype=np.float32) for k in ("pfr", "alt", "shallow_ice")}
    for hemi, (pfr_name, alt_name) in FILES.items():
        process(raw, pfr_name, alt_name, out)
    out["permafrost"] = np.nan_to_num(out["pfr"]) >= PFR_MIN
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_path, **out)
    n = int(out["permafrost"].sum())
    print("saved", out_path, "permafrost cells:", n)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
