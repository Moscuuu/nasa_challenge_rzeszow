"""Measure the dominant spacing of patterned ground (thermal-contraction polygons) on ArcticDEM 2 m.

For each target point a 2 x 2 km ArcticDEM v4 2 m patch is taken from Earth Engine (polar stereographic,
EPSG:3413), detrended (minus a 50 m Gaussian), Hann-windowed and Fourier-transformed. Polygon troughs
repeat at the polygon diameter, so they show up as a peak in the radially averaged power spectrum above
the red-noise background (a power law fitted in log-log space). We report the peak wavelength in the
6-60 m band and its prominence (peak power / background).

RESULT OF THE CONTROLS (2026-11-14): the method is NOT reliable. On Utqiagvik (Alaska, well-known
ice-wedge polygons) the polygons are barely visible at 2 m (DEM noise ~ trough depth), and a mountain cell
in Yakutia gave the strongest peak from slope gullies. Output is flagged validated=false; the hillshade
previews are for visual inspection by a person.

Targets: the best 0-1 m cells north of 60 N (ArcticDEM coverage), one per named place.

Outputs: data/interim/polygon_checks.json, out/polygon_checks/<id>.png (hillshade previews)

Usage: python pipeline/polygon_check.py data/interim out
"""
import io
import json
import sys
from pathlib import Path

import ee
import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy import ndimage

PIX = 2.0
N = 1024  # 2 km patch
BAND = (6.0, 60.0)  # polygon diameters we look for [m]
N_TARGETS = 4
CONTROLS = [
    {"id": "control_utqiagvik", "name": "Utqiagvik, Alaska (control: known ice-wedge polygons)", "lat": 71.30, "lon": -156.65},
    {"id": "control_haughton", "name": "Haughton crater, Devon Island (known analog)", "lat": 75.38, "lon": -89.68},
]
TO_3413 = Transformer.from_crs("EPSG:4326", "EPSG:3413", always_xy=True)


def fetch_patch(lat: float, lon: float) -> np.ndarray:
    x, y = TO_3413.transform(lon, lat)
    x0, y0 = x - N * PIX / 2, y + N * PIX / 2
    req = {
        "expression": ee.Image("UMN/PGC/ArcticDEM/V4/2m_mosaic").select("elevation").toFloat(),
        "fileFormat": "NPY",
        "grid": {"dimensions": {"width": N, "height": N},
                 "affineTransform": {"scaleX": PIX, "shearX": 0, "translateX": x0,
                                     "shearY": 0, "scaleY": -PIX, "translateY": y0},
                 "crsCode": "EPSG:3413"},
    }
    a = np.load(io.BytesIO(ee.data.computePixels(req)))["elevation"].astype(np.float64)
    a[(a < -500) | (a > 9000) | (a == 0)] = np.nan
    return a


def spectrum(dem: np.ndarray) -> dict:
    valid = np.isfinite(dem)
    if valid.mean() < 0.8:
        return {"status": "no_data", "valid_fraction": round(float(valid.mean()), 3)}
    z = np.where(valid, dem, np.nanmedian(dem))
    z = z - ndimage.gaussian_filter(z, sigma=25)  # remove relief > ~50 m
    w = np.hanning(N)
    p = np.abs(np.fft.fftshift(np.fft.fft2(z * np.outer(w, w)))) ** 2
    f = np.fft.fftshift(np.fft.fftfreq(N, d=PIX))
    fx, fy = np.meshgrid(f, f)
    fr = np.hypot(fx, fy)
    with np.errstate(divide="ignore"):
        wl = np.where(fr > 0, 1.0 / fr, np.inf)
    edges = np.geomspace(4.0, 200.0, 41)
    centres = np.sqrt(edges[:-1] * edges[1:])
    power = np.array([p[(wl >= lo) & (wl < hi)].mean() for lo, hi in zip(edges[:-1], edges[1:])])
    lw, lp = np.log10(centres), np.log10(power)
    slope, icpt = np.polyfit(lw, lp, 1)
    resid = lp - (slope * lw + icpt)
    in_band = (centres >= BAND[0]) & (centres <= BAND[1])
    i = np.argmax(np.where(in_band, resid, -np.inf))
    prominence = float(10 ** resid[i])
    # No "detected" flag: on the controls the spectral peak did not separate real polygons (Utqiagvik)
    # from slope gullies (mountain cells), so the numbers are reported only as raw spectral values.
    return {"status": "ok", "peak_wavelength_m": round(float(centres[i]), 1), "prominence": round(prominence, 2),
            "relief_std_m": round(float(z.std()), 3), "valid_fraction": round(float(valid.mean()), 3)}


def hillshade_png(dem: np.ndarray, path: Path) -> None:
    z = np.where(np.isfinite(dem), dem, np.nanmedian(dem))
    gy, gx = np.gradient(z, PIX)
    az, alt = np.radians(315), np.radians(35)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    img = np.clip((hs - np.percentile(hs, 1)) / (np.percentile(hs, 99) - np.percentile(hs, 1)), 0, 1)
    Image.fromarray((img * 255).astype(np.uint8)).save(path, optimize=True)


def targets(interim: Path) -> list:
    places = json.loads((interim / "places.json").read_text(encoding="utf-8"))
    with np.load(interim / "scores_0-1m.npz") as z:
        best, rows, cols, rank = z["best"], z["rows"], z["cols"], z["rank"]
    out, seen = [], set()
    for k in np.argsort(-np.nan_to_num(best, nan=-1), kind="stable"):
        lat, lon = 90 - (rows[k] + 0.5) * 0.1, -180 + (cols[k] + 0.5) * 0.1
        if lat < 60:
            continue
        cid = f"c_{lat:.2f}_{lon:.2f}"
        place = places.get(cid) or cid
        if place in seen:
            continue
        seen.add(place)
        out.append({"id": cid, "name": place, "lat": round(lat, 2), "lon": round(lon, 2),
                    "rank_0_1m": int(rank[k]), "score_0_1m": round(float(best[k]), 3)})
        if len(out) == N_TARGETS:
            break
    return out


def main(interim: Path, out: Path) -> None:
    ee.Initialize()
    preview_dir = out / "polygon_checks"
    preview_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for t in CONTROLS + targets(interim):
        dem = fetch_patch(t["lat"], t["lon"])
        res = {**t, **spectrum(dem)}
        if res["status"] == "ok":
            hillshade_png(dem, preview_dir / f"{t['id']}.png")
            res["preview"] = f"polygon_checks/{t['id']}.png"
        results.append(res)
        print(json.dumps(res, ensure_ascii=False), flush=True)
    report = {
        "validated": False,
        "note": ("Automatic spectral check on ArcticDEM 2 m. NOT a validated polygon measurement: on the control "
                 "with known ice-wedge polygons (Utqiagvik) the pattern is barely visible at 2 m, and on mountain "
                 "cells slope gullies produce spectral peaks. Use the hillshade previews for visual inspection only."),
        "checks": results,
    }
    (interim / "polygon_checks.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    (out / "polygon_checks.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
