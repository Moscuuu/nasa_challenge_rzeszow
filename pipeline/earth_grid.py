"""Aggregate ESA Permafrost CCI v5 (0.01 deg) to the global 0.1 deg grid.

Grid: 1800 x 3600, row 0 = 90..89.9 N, col 0 = -180..-179.9 (same as fetch_era5.py).
Output data/interim/earth_grid.npz:
  pfr          mean permafrost fraction in the cell [0..1]
  alt          mean active-layer thickness over permafrost pixels [m]
  shallow_ice  mean of PFR * clip(1 - ALT/1 m, 0, 1) over the cell ("shallow ice certainty", 0..1)
  permafrost   bool mask: cell counts as permafrost (pfr >= PFR_MIN)
  ice_1_5      mean of PFR * frozen share of the 1-5 m layer, clip((5 - max(ALT, 1)) / 4, 0, 1)
  ice_gt5      mean PFR (ground below 5 m is permafrost wherever permafrost exists)
  t2m, t5m, t10m  mean annual ground temperature at 2 / 5 / 10 m [K]
  t_1_5        (t2m + t5m) / 2, Depth Layer 1-5 m;  t_gt5 = t10m, Depth Layer > 5 m
  gst          mean annual ground surface temperature [K]
  crack        thermal-contraction cracking potential, clip((-2 C - GST) / 18 K, 0, 1)

Usage: python -I pipeline/earth_grid.py data/raw/cci data/interim/earth_grid.npz
"""
import sys
from pathlib import Path

import netCDF4
import numpy as np

NX, NY, RES = 3600, 1800, 0.1
PFR_MIN = 0.10  # cells below 10 % permafrost ("isolated") are not counted as permafrost
FILES = {
    "N": tuple(f"ESACCI-PERMAFROST-L4-{v}-MODISLST_CRYOGRID-AREA4_PP-2023-fv05.0.nc" for v in ("PFR", "ALT", "GTD")),
    "S": tuple(f"ESACCI-PERMAFROST-L4-{v}-MODISLST_CRYOGRID-AREA27_PP-2023-fv05.0.nc" for v in ("PFR", "ALT", "GTD")),
}
OUT_VARS = ("pfr", "alt", "shallow_ice", "ice_1_5", "ice_gt5", "gst", "t2m", "t5m", "t10m")
# Thermal-contraction cracking potential from mean annual ground surface temperature (Pewe 1966 regimes,
# as in the Permafrost_cci Dataset Analysis): none above -2 C, rising to full at <= -20 C (cold, dry cracking).
CRACK_START_K, CRACK_FULL_K = 271.15, 253.15
STRIPE = 500  # fine rows per read (multiple of 10)


def block_mean(values: np.ndarray, valid: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean over 10x10 blocks of valid pixels; returns (mean, valid_count)."""
    r, c = values.shape
    v = np.where(valid, values, 0.0).reshape(r // 10, 10, c // 10, 10)
    n = valid.reshape(r // 10, 10, c // 10, 10).sum(axis=(1, 3))
    s = v.sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(n > 0, s / n, np.nan), n


def process(raw: Path, pfr_name: str, alt_name: str, gtd_name: str, out: dict) -> None:
    dp, da, dg = (netCDF4.Dataset(raw / n) for n in (pfr_name, alt_name, gtd_name))
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

        frozen_1_5 = np.clip((5.0 - np.maximum(alt_v, 1.0)) / 4.0, 0.0, 1.0)
        ice15_v = np.where(alt_valid, pfr_v * frozen_1_5, 0.0)

        coarse = {
            "pfr": block_mean(pfr_v, pfr_valid)[0],
            "alt": block_mean(alt_v, alt_valid)[0],
            "shallow_ice": block_mean(ice_v, pfr_valid)[0],
            "ice_1_5": block_mean(ice15_v, pfr_valid)[0],
            "ice_gt5": block_mean(pfr_v, pfr_valid)[0],
        }
        for var, name in (("GST", "gst"), ("T2m", "t2m"), ("T5m", "t5m"), ("T10m", "t10m")):
            t = dg[var][0, r0:r1, :]
            coarse[name] = block_mean(np.ma.getdata(t).astype(np.float64) + 273.15, ~np.ma.getmaskarray(t))[0]

        # map coarse rows to global grid rows (row 0 = 90 N)
        k = np.arange(coarse["pfr"].shape[0])
        edge = lat0 + (r0 / 10 + k) * (0.1 if ascending else -0.1)
        centre = edge + (0.05 if ascending else -0.05)
        rows = np.floor((90.0 - centre) / RES).astype(int)
        for name, arr in coarse.items():
            out[name][rows] = np.where(np.isnan(arr), out[name][rows], arr)
        print(pfr_name[-30:-24], r0, r1, flush=True)
    for d in (dp, da, dg):
        d.close()


def main(raw: Path, out_path: Path) -> None:
    out = {k: np.full((NY, NX), np.nan, dtype=np.float32) for k in OUT_VARS}
    for hemi, names in FILES.items():
        process(raw, *names, out)
    out["permafrost"] = np.nan_to_num(out["pfr"]) >= PFR_MIN
    out["t_1_5"] = (out["t2m"] + out["t5m"]) / 2
    out["t_gt5"] = out["t10m"]
    out["crack"] = np.clip((CRACK_START_K - out["gst"]) / (CRACK_START_K - CRACK_FULL_K), 0.0, 1.0)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_path, **out)
    n = int(out["permafrost"].sum())
    print("saved", out_path, "permafrost cells:", n)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
