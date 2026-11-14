"""Write the GUI hand-off files (docs/contracts/analysis-to-gui/CONTRACT.md) into out/.

Usage: python -I pipeline/export.py data/interim out
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

LAYER = "0-1m"
RES = 0.1
TOP_N = 2000
CONTRACT_VERSION = "0.2"
FEATURES = [
    {"id": "temperature", "label": "Temperature", "comparison": "rank"},
    {"id": "ground_ice", "label": "Ground ice", "comparison": "position"},
    {"id": "polygons", "label": "Thermal-contraction polygons", "comparison": "presence"},
]
SOURCES = [
    {"id": "era5_land", "label": "ERA5-Land hourly / daily aggregates (ECMWF, via Google Earth Engine), 2023", "url": "https://doi.org/10.24381/cds.e2161bac"},
    {"id": "esa_cci_permafrost", "label": "ESA Permafrost CCI v5.0 (PFR, ALT), 2023", "url": "https://climate.esa.int/en/projects/permafrost/"},
    {"id": "swim", "label": "SWIM4MIM ice consistency composites (PSI / NASA)", "url": "https://swim.psi.edu"},
    {"id": "mars_thermal_model", "label": "Team 1-D Mars surface thermal model (A=0.25, I=250)", "url": None},
]
KNOWN = [("McMurdo Dry Valleys", (160.5, -78.0, 163.0, -77.2)),
         ("Haughton Crater (Devon Island)", (-91.0, 74.9, -88.0, 76.0))]


def r3(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 3)


def known_analog(lon, lat):
    for name, (x0, y0, x1, y1) in KNOWN:
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            return name
    return None


def site_feature(s):
    t = s["temperature"]
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
        "properties": {
            "id": s["id"], "name": s["name"], "window_deg": s["window_deg"], "coords_status": s["coords_status"],
            "features": {
                "temperature": {"tmin_K": t["tmin"], "tmax_K": t["tmax"], "amp_K": t["amp"],
                                "unit": "K (surface, mean daily, whole Mars year)", "source": "mars_thermal_model"},
                "ground_ice": {"value": s["ice"][LAYER]["c"], "rank": s["ice"][LAYER]["percentile"],
                               "unit": "SWIM ice consistency C, 0-1 m (-1..1)", "source": "swim"},
                "polygons": {"value": None, "rank": None, "unit": None, "source": None, "status": "pending"},
            },
            "chlorine_wt_pct": s["chlorine_wt_pct"],
            "description": s["description"], "citation": s["citation"],
        },
    }


def strengths_breaks(feats):
    ok = {k: v["score"] for k, v in feats.items() if v["status"] == "ok"}
    if not ok:
        return [], []
    strengths = [k for k, v in sorted(ok.items(), key=lambda kv: -kv[1]) if v >= 0.8] or [max(ok, key=ok.get)]
    breaks = [k for k, v in sorted(ok.items(), key=lambda kv: kv[1]) if v < 0.5]
    return strengths, breaks


def score_png(path: Path, rows, cols, values):
    img = np.zeros((1800, 3600, 4), dtype=np.uint8)
    ok = np.isfinite(values)
    g = np.clip(np.round(values[ok] * 255), 0, 255).astype(np.uint8)
    for ch in range(3):
        img[rows[ok], cols[ok], ch] = g
    img[rows[ok], cols[ok], 3] = 255
    Image.fromarray(img, "RGBA").save(path, optimize=True)


def main(interim: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))
    sc = np.load(interim / f"scores_{LAYER}.npz")
    windows_path = interim / f"experiment_window_{LAYER}.json"
    windows = json.loads(windows_path.read_text(encoding="utf-8")) if windows_path.exists() else {}
    site_ids = [s["id"] for s in sites]
    rows, cols = sc["rows"], sc["cols"]
    lat = 90 - (rows + 0.5) * RES
    lon = -180 + (cols + 0.5) * RES

    # Mars sites
    (out / "mars_sites.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "features": [site_feature(s) for s in sites]}, indent=1), encoding="utf-8")

    # top cells
    top = np.argsort(-np.nan_to_num(sc["best"], nan=-1), kind="stable")[:TOP_N]
    feats_out = []
    for k in top:
        b = int(sc["best_site"][k])
        s = sites[b]
        cid = f"c_{lat[k]:.2f}_{lon[k]:.2f}"
        temp_ok = np.isfinite(sc["temperature"][b, k])
        feats = {
            "temperature": {
                "score": r3(sc["temperature"][b, k]),
                "parts": {q: r3(sc["temp_parts"][b, j, k]) for j, q in enumerate(("tmin", "tmax", "amp"))},
                "earth_value": {"tmin_K": r3(sc["earth_tmin"][k]), "tmax_K": r3(sc["earth_tmax"][k]), "amp_K": r3(sc["earth_amp"][k])},
                "mars_value": {"tmin_K": s["temperature"]["tmin"], "tmax_K": s["temperature"]["tmax"], "amp_K": s["temperature"]["amp"]},
                "unit": "K (surface skin temperature, mean daily)",
                "status": "ok" if temp_ok else "no_data", "source": "era5_land",
            },
            "ground_ice": {
                "score": r3(sc["ice"][b, k]),
                "earth_value": {"shallow_ice_certainty": r3(sc["shallow_ice"][k]), "active_layer_m": r3(sc["alt"][k]),
                                "permafrost_fraction": r3(sc["pfr"][k])},
                "mars_value": {"swim_c": s["ice"][LAYER]["c"]},
                "unit": "compared by percentile on each planet",
                "status": "ok", "source": "esa_cci_permafrost",
            },
            "polygons": {"score": None, "earth_value": None, "mars_value": None, "unit": None,
                         "status": "pending", "source": None},
        }
        strengths, breaks = strengths_breaks(feats)
        feats_out.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lon[k]), 2), round(float(lat[k]), 2)]},
            "properties": {
                "id": cid, "rank": int(sc["rank"][k]), "percentile": round(float(sc["percentile"][k]) * 100, 3),
                "score": r3(sc["best"][k]), "best_site_id": site_ids[b],
                "site_scores": {sid: r3(sc["overall"][i, k]) for i, sid in enumerate(site_ids)},
                "features": feats, "strengths": strengths, "breaks_down": breaks,
                "known_analog": known_analog(lon[k], lat[k]), "place": None,
                "experiment_window": windows.get(cid),
            },
        })
    (out / f"cells_top_{LAYER}.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "layer": LAYER, "features": feats_out}, separators=(",", ":")), encoding="utf-8")

    # heat maps
    maps = {"best": f"score_{LAYER}_best.png"}
    score_png(out / maps["best"], rows, cols, sc["best"])
    for i, sid in enumerate(site_ids):
        maps[sid] = f"score_{LAYER}_{sid}.png"
        score_png(out / maps[sid], rows, cols, sc["overall"][i])

    # validation + manifest
    val = json.loads((interim / f"validation_{LAYER}.json").read_text(encoding="utf-8"))
    (out / "validation.json").write_text(json.dumps(val, indent=1), encoding="utf-8")
    manifest = {
        "contract_version": CONTRACT_VERSION,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mock": False,
        "cell_size_deg": RES,
        "layers": [{"id": "0-1m", "label": "0–1 m (dig-able ice)", "available": True},
                   {"id": "1-5m", "label": "1–5 m (shallow drilling)", "available": False},
                   {"id": "gt5m", "label": "> 5 m (deep resources)", "available": False}],
        "features": FEATURES,
        "sites": site_ids,
        "files": {"mars_sites": "mars_sites.geojson", "cells_top": {LAYER: f"cells_top_{LAYER}.geojson"},
                  "score_maps": {LAYER: maps}, "validation": "validation.json"},
        "sources": SOURCES,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", out, "top cells", len(feats_out), "windows", sum(1 for f in feats_out if f["properties"]["experiment_window"]))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
