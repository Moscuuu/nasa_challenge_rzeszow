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
# coords_status: "published" = a point given in a primary source (coords_source);
#                "approximate" = no published point found; centre of the published area, from memory/maps.
SITES = [
    {"id": "arcadia_planitia", "name": "Arcadia Planitia", "lat": 46.58, "lon": -165.15, "coords_status": "published",
     "coords_source": "Bramson et al. 2015, GRL 42:6566: terraced crater 'Badger' (46.581 N, 194.85 E) inside the mapped excess-ice layer (38-52 N)",
     "description": "Mid-latitude plains with a widespread shallow excess-ice layer mapped by radar and fresh ice-exposing craters.",
     "citation": "Bramson et al. 2015, GRL; Morgan et al. 2021, Nature Astronomy (SWIM)"},
    {"id": "deuteronilus_mensae", "name": "Deuteronilus Mensae", "lat": 39.11, "lon": 23.20, "coords_status": "published",
     "coords_source": "Head et al. 2015, First Landing Site/Exploration Zone Workshop, abstract 1033: EZ centre",
     "description": "Mesas fringed by debris-covered glaciers and lobate aprons holding buried ice.",
     "citation": "Head et al. 2015 and Plaut 2015, Exploration Zone Workshop (abstracts 1033, 1044)"},
    {"id": "phlegra_montes", "name": "Phlegra Montes", "lat": 40.0, "lon": 164.0, "coords_status": "approximate",
     "coords_source": "No published point found for Phlegra Montes itself; nearest published landing site: Barker et al. 2015 (EZ abstract 1002), Phlegra Dorsa 39 N 172 E",
     "description": "Mountain range with radar-detected ice in surrounding aprons, proposed for human exploration.",
     "citation": "Morgan et al. 2021, Nature Astronomy (SWIM)"},
    {"id": "erebus_montes", "name": "Erebus Montes", "lat": 39.0, "lon": -167.9, "coords_status": "published",
     "coords_source": "Viola, McEwen & Dundas 2015, Exploration Zone Workshop, abstract 1011: EZ centre (39.0 N, 192.1 E)",
     "description": "Isolated massifs with ice-rich debris aprons at relatively low latitude.",
     "citation": "Viola et al. 2015, Exploration Zone Workshop (abstract 1011)"},
    {"id": "amazonis_posiolova", "name": "Amazonis Planitia (Posiolova crater)", "lat": 35.1, "lon": -170.2, "coords_status": "published",
     "coords_source": "Posiolova et al. 2022, Science 378:412; Dundas et al. 2023, GRL: Dec 2021 ice-exposing crater (35.1 N, ~189.8 E, +-0.1 deg)",
     "description": "A 2021 impact excavated ice boulders here, the lowest-latitude ice exposure seen.",
     "citation": "Posiolova et al. 2022, Science"},
    {"id": "utopia_planitia", "name": "Utopia Planitia", "lat": 45.0, "lon": 95.0, "coords_status": "approximate",
     "coords_source": "Stuurman et al. 2016, GRL: deposit spans ~39-49 N in western Utopia; longitude of the centre not verified",
     "description": "Scalloped terrain over a radar-detected ice deposit comparable in volume to Lake Superior.",
     "citation": "Stuurman et al. 2016, GRL"},
    {"id": "hellas_rim", "name": "Hellas rim", "lat": -39.05, "lon": 101.91, "coords_status": "published",
     "coords_source": "Levy & Holt 2015, Exploration Zone Workshop, abstract 1037: EZ centre on the eastern Hellas rim",
     "description": "Lobate debris aprons on the eastern Hellas rim, among the few southern ice-rich candidates.",
     "citation": "Holt et al. 2008, Science; Levy & Holt 2015, Exploration Zone Workshop (abstract 1037)"},
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


POLYGONS_TIF = Path("landforms/SWIM4MIM_G_0_1_Ancillary/SWIM4MIM_Polygons_GIS.tif")


def polygon_stats(swim_dir: Path, sites: list) -> list:
    """Share of SWIM survey images showing HiRISE-scale polygons, per site window.

    -30 = not surveyed (no data). Rows poleward of the survey band (~47.9 S - 49.0 N) are filled with 0
    that means "not surveyed", so they are masked too. Mars-wide ranking uses surveyed pixels only (mid-rank).
    """
    with rasterio.open(swim_dir / POLYGONS_TIF) as src:
        a = src.read(1).astype(np.float64)
    a[(a < -1) | (a > 1e6)] = np.nan
    a = np.clip(a, 0, 1)
    res = 0.05
    surveyed_rows = np.where(np.nanmax(np.nan_to_num(a, nan=0), axis=1) > 0)[0]
    a[: surveyed_rows.min()] = np.nan
    a[surveyed_rows.max() + 1:] = np.nan
    allpix = a[np.isfinite(a)]
    out = []
    for s in sites:
        half = WINDOW_DEG / 2
        r0, r1 = int((60 - (s["lat"] + half)) / res), int((60 - (s["lat"] - half)) / res)
        c0, c1 = int((s["lon"] - half + 180) / res), int((s["lon"] + half + 180) / res)
        win = a[r0:r1, c0:c1]
        if not np.isfinite(win).any():
            out.append({"value": None, "percentile": None, "status": "no_data"})
            continue
        v = float(np.nanmean(win))
        pct = ((allpix < v).mean() + (allpix <= v).mean()) / 2
        out.append({"value": round(v, 4), "percentile": round(float(pct), 4), "status": "ok"})
    return out


def main(swim_dir: Path, out: Path) -> None:
    lats = np.array([s["lat"] for s in SITES])
    temps = run_sites(lats, np.full(lats.size, ALBEDO), np.full(lats.size, INERTIA))
    polygons = polygon_stats(swim_dir, SITES)
    result = []
    for i, s in enumerate(SITES):
        ice = {}
        for layer, fname in (("0-1m", "SWIM4MIM_Ci_0_1.tif"), ("1-5m", "SWIM4MIM_Ci_1_5.tif"),
                             ("gt5m", "SWIM4MIM_Ci_5.tif")):
            c, allpix = swim_window_mean(swim_dir / fname, s["lat"], s["lon"])
            # Rank among ice-consistent pixels (C > 0): the Earth side is ranked among permafrost cells,
            # i.e. ground that already holds ice, so both populations mean "places with ground ice".
            # Mid-rank: SWIM values are strongly discretised (many pixels exactly 0.5), so ties share
            # the average of "strictly below" and "below or equal".
            icy = allpix[allpix > 0]
            pct = ((icy < c).mean() + (icy <= c).mean()) / 2
            ice[layer] = {"c": round(c, 4), "percentile": round(float(pct), 4)}
        result.append({
            **s,
            "window_deg": WINDOW_DEG,
            "albedo": ALBEDO, "thermal_inertia": INERTIA,
            "temperature": {
                **{k: round(float(temps[k][i]), 2) for k in (
                    "tmin", "tmax", "amp", "summer_tmin", "summer_tmax", "summer_amp", "tmean", "abs_min", "abs_max",
                    "t2m", "t5m", "t_deep")},
                # Depth Layer temperatures (annual mean), same definition as the Earth side
                "t_1_5": round(float((temps["t2m"][i] + temps["t5m"][i]) / 2), 2),
                "t_gt5": round(float(temps["t_deep"][i]), 2),
            },
            "diurnal_profile_K": [round(float(v), 2) for v in temps["diurnal_profile"][i]],
            "ice": ice,
            "polygons": polygons[i],
            "chlorine_wt_pct": None,
        })
        t = result[-1]["temperature"]
        print(f"{s['id']:22s} C0-1 {ice['0-1m']['c']:+.2f} (p{ice['0-1m']['percentile']:.2f})  "
              f"tmin {t['tmin']:.0f} tmax {t['tmax']:.0f} amp {t['amp']:.0f} K")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
