"""Per-site Mars surface properties from MGS TES maps.

Albedo: TES global bolometric albedo, 8 ppd (Christensen et al. 2001, PDS mgs-m-tes-special-v1).
Thermal inertia: night-time annual map, 20 ppd (Putzig & Mellon 2007, PDS mgs-m-tes-5-timap-v1),
with its interpolation mask (0 = pixel infilled by interpolation).
"""
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

_DTYPES = {
    ("PC_REAL", 32): "<f4", ("MSB_INTEGER", 16): ">i2", ("MSB_INTEGER", 8): ">u1",
    ("LSB_INTEGER", 16): "<i2", ("MSB_UNSIGNED_INTEGER", 8): ">u1", ("MSB_UNSIGNED_INTEGER", 16): ">u2",
    ("IEEE_REAL", 32): ">f4", ("PC_INTEGER", 16): "<i2",
}


def _parse_label(text: str) -> dict:
    out = {}
    for m in re.finditer(r'^\s*\^?([A-Z_]+)\s*=\s*(.+?)\s*$', text, re.M):
        out.setdefault(m.group(1), m.group(2))
    return out


def _num(s: str) -> float:
    return float(re.match(r"[-+0-9.eE]+", s.strip()).group(0))


def _find_label(img: Path) -> Path:
    for ext in (".lbl", ".LBL"):
        p = img.with_suffix(ext)
        if p.exists():
            return p
    return img  # attached label


@lru_cache(maxsize=None)
def load_map(img: Path, nodata: float | None = None) -> tuple[np.ndarray, dict]:
    """Read a PDS3 map image via its label. Returns (float64 array with NaN nodata, geo dict east-positive).

    nodata: raw value to treat as no data when the label gives no MISSING_CONSTANT (e.g. 0 for the TI map).
    Results are cached per (path, nodata): treat the returned array as read-only.
    No wrap at +-180 deg: window_mean raises for a box crossing the map edge (no Mars site lies within 0.5 deg of it).
    """
    img = Path(img)
    lab_path = _find_label(img)
    head = lab_path.read_bytes()[:20000].decode("latin-1")
    lab = _parse_label(head.split("\nEND\n")[0] if lab_path != img else head.split("\nEND")[0])
    lines, samples = int(lab["LINES"]), int(lab["LINE_SAMPLES"])
    dtype = _DTYPES[(lab["SAMPLE_TYPE"].strip('"'), int(lab["SAMPLE_BITS"]))]
    offset = 0
    if lab_path == img:  # attached label: data starts after label records
        offset = int(lab["LABEL_RECORDS"]) * int(lab["RECORD_BYTES"])
    arr = np.fromfile(img, dtype=dtype, count=lines * samples, offset=offset).reshape(lines, samples).astype("f8")
    if "MISSING_CONSTANT" in lab:
        arr[arr == _num(lab["MISSING_CONSTANT"])] = np.nan
    elif nodata is not None:
        arr[arr == nodata] = np.nan
    arr = arr * (_num(lab["SCALING_FACTOR"]) if "SCALING_FACTOR" in lab else 1.0) \
        + (_num(lab["OFFSET"]) if "OFFSET" in lab else 0.0)
    west, east = _num(lab["WESTERNMOST_LONGITUDE"]), _num(lab["EASTERNMOST_LONGITUDE"])
    if lab["POSITIVE_LONGITUDE_DIRECTION"].strip('"').upper() == "WEST":
        west, east = -east, -west
        arr = arr[:, ::-1]
    geo = {"lat_max": _num(lab["MAXIMUM_LATITUDE"]), "lat_min": _num(lab["MINIMUM_LATITUDE"]),
           "lon_west_east": west, "ppd": _num(lab["MAP_RESOLUTION"])}
    return arr, geo


def window_mean(arr: np.ndarray, geo: dict, lat: float, lon: float, half_deg: float = 0.5,
                mask: np.ndarray | None = None) -> float:
    """Mean of finite (and mask-kept) pixels in a lat/lon box centred on the point."""
    ppd = geo["ppd"]
    r0 = int(np.floor((geo["lat_max"] - (lat + half_deg)) * ppd))
    r1 = int(np.ceil((geo["lat_max"] - (lat - half_deg)) * ppd))
    c0 = int(np.floor((lon - half_deg - geo["lon_west_east"]) * ppd))
    c1 = int(np.ceil((lon + half_deg - geo["lon_west_east"]) * ppd))
    if r0 < 0 or c0 < 0 or r1 > arr.shape[0] or c1 > arr.shape[1]:
        raise ValueError(f"box around ({lat}, {lon}) lies outside the map")
    win = arr[r0:r1, c0:c1]
    ok = np.isfinite(win)
    if mask is not None:
        ok &= mask[r0:r1, c0:c1]
    if not ok.any():
        raise ValueError(f"no valid pixel around ({lat}, {lon})")
    return float(win[ok].mean())


def site_surface(lat: float, lon: float, raw_dir: Path = Path("data/raw/tes")) -> dict:
    raw_dir = Path(raw_dir)
    alb, ageo = load_map(raw_dir / "global_albedo_8ppd.img")
    ti, tgeo = load_map(raw_dir / "GLOBAL_TI_NIGHT_2007.IMG", nodata=0)  # TI map: 0 = no data (min real value is 4)
    msk, _ = load_map(raw_dir / "GLOBAL_TI_MSK_NIGHT_2007.IMG")
    return {
        "albedo": window_mean(alb, ageo, lat, lon),
        "thermal_inertia": window_mean(ti, tgeo, lat, lon, mask=(msk == 1)),
        "albedo_source": "tes_albedo_christensen2001",
        "ti_source": "tes_ti_putzig_mellon2007",
    }
