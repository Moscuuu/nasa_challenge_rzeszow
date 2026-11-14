"""Characterise the 7 Mars Base Candidate Sites: SWIM ice consistency and modelled surface temperature.

Output: data/interim/mars_sites.json

Usage: python -I pipeline/mars_sites.py data/raw/swim data/interim/mars_sites.json
"""
import json
import sys
from pathlib import Path

import numpy as np
import rasterio

from mars_thermal import run_sites

WINDOW_DEG = 1.0
ALBEDO, INERTIA = 0.25, 250.0  # same first-order values as the SWIM analysis

# Coordinates: planetocentric latitude, east-positive longitude in -180..180.
# Approximate centres of the published candidate areas (coords_status = "approximate").
SITES = [
    {"id": "arcadia_planitia", "name": "Arcadia Planitia", "lat": 42.0, "lon": -160.0,
     "description": "Mid-latitude plains with a widespread shallow excess-ice layer mapped by radar and fresh ice-exposing craters.",
     "citation": "Bramson et al. 2015, GRL; Morgan et al. 2021, Nature Astronomy (SWIM)"},
    {"id": "deuteronilus_mensae", "name": "Deuteronilus Mensae", "lat": 44.0, "lon": 22.0,
     "description": "Mesas fringed by debris-covered glaciers and lobate aprons holding buried ice.",
     "citation": "Plaut et al. 2009, GRL; First Landing Site/Exploration Zone Workshop 2015"},
    {"id": "phlegra_montes", "name": "Phlegra Montes", "lat": 40.0, "lon": 164.0,
     "description": "Mountain range with radar-detected ice in surrounding aprons, proposed for human exploration.",
     "citation": "Dundas et al. 2021; Morgan et al. 2021, Nature Astronomy"},
    {"id": "erebus_montes", "name": "Erebus Montes", "lat": 35.7, "lon": 175.0,
     "description": "Isolated massifs with ice-rich debris aprons at relatively low latitude.",
     "citation": "Morgan et al. 2021, Nature Astronomy (SWIM)"},
    {"id": "amazonis_posiolova", "name": "Amazonis Planitia (Posiolova crater)", "lat": 35.1, "lon": -170.3,
     "description": "A 2021 impact excavated ice boulders here, the lowest-latitude ice exposure seen.",
     "citation": "Posiolova et al. 2022, Science"},
    {"id": "utopia_planitia", "name": "Utopia Planitia", "lat": 45.0, "lon": 95.0,
     "description": "Scalloped terrain over a radar-detected ice deposit comparable in volume to Lake Superior.",
     "citation": "Stuurman et al. 2016, GRL"},
    {"id": "hellas_rim", "name": "Hellas rim", "lat": -40.0, "lon": 104.0,
     "description": "Lobate debris aprons on the eastern Hellas rim, among the few southern ice-rich candidates.",
     "citation": "Holt et al. 2008, Science"},
]


def swim_window_mean(path: Path, lat: float, lon: float) -> tuple[float, np.ndarray]:
    """Mean SWIM C in a WINDOW_DEG box; also returns all valid pixels (for the Mars-wide ranking)."""
    with rasterio.open(path) as src:
        a = src.read(1).astype(np.float64)
    a[(a < -1.5) | (a > 1.5)] = np.nan  # nodata (-30, -3.4e38)
    res = 0.05
    half = WINDOW_DEG / 2
    r0, r1 = int((60 - (lat + half)) / res), int((60 - (lat - half)) / res)
    c0, c1 = int((lon - half + 180) / res), int((lon + half + 180) / res)
    return float(np.nanmean(a[r0:r1, c0:c1])), a[np.isfinite(a)]


def main(swim_dir: Path, out: Path) -> None:
    lats = np.array([s["lat"] for s in SITES])
    temps = run_sites(lats, np.full(lats.size, ALBEDO), np.full(lats.size, INERTIA))
    result = []
    for i, s in enumerate(SITES):
        ice = {}
        for layer, fname in (("0-1m", "SWIM4MIM_Ci_0_1.tif"), ("1-5m", "SWIM4MIM_Ci_1_5.tif"),
                             ("gt5m", "SWIM4MIM_Ci_5.tif")):
            c, allpix = swim_window_mean(swim_dir / fname, s["lat"], s["lon"])
            ice[layer] = {"c": round(c, 4), "percentile": round(float((allpix < c).mean()), 4)}
        result.append({
            **s,
            "window_deg": WINDOW_DEG,
            "coords_status": "approximate",
            "albedo": ALBEDO, "thermal_inertia": INERTIA,
            "temperature": {k: round(float(temps[k][i]), 2) for k in ("tmin", "tmax", "amp", "tmean", "abs_min", "abs_max")},
            "diurnal_profile_K": [round(float(v), 2) for v in temps["diurnal_profile"][i]],
            "ice": ice,
            "chlorine_wt_pct": None,
        })
        t = result[-1]["temperature"]
        print(f"{s['id']:22s} C0-1 {ice['0-1m']['c']:+.2f} (p{ice['0-1m']['percentile']:.2f})  "
              f"tmin {t['tmin']:.0f} tmax {t['tmax']:.0f} amp {t['amp']:.0f} K")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
