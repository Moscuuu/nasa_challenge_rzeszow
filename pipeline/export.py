"""Write the GUI hand-off files (docs/contracts/analysis-to-gui/CONTRACT.md) into out/.

Exports every Depth Layer that has data/interim/scores_<layer>.npz, plus one shared manifest.

Usage: python -I pipeline/export.py data/interim out
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

LAYERS = [("0-1m", "0–1 m (dig-able ice)"), ("1-5m", "1–5 m (shallow drilling)"), ("gt5m", "> 5 m (deep resources)")]
RES = 0.1
TOP_N = 2000
CONTRACT_VERSION = "0.7"
FEATURES = [
    {"id": "temperature", "label": "Temperature", "comparison": "rank"},
    {"id": "ground_ice", "label": "Ground ice", "comparison": "position"},
    {"id": "polygons", "label": "Thermal-contraction polygons", "comparison": "presence"},
]
SOURCES = [
    {"id": "era5_land", "label": "ERA5-Land hourly / daily aggregates (ECMWF, via Google Earth Engine), 2023", "url": "https://doi.org/10.24381/cds.e2161bac"},
    {"id": "esa_cci_permafrost", "label": "ESA Permafrost CCI v5.0 (PFR, ALT, ground temperature), 2023", "url": "https://climate.esa.int/en/projects/permafrost/"},
    {"id": "swim", "label": "SWIM4MIM ice consistency composites (PSI / NASA)", "url": "https://swim.psi.edu"},
    {"id": "mars_thermal_model", "label": "Team 1-D Mars surface thermal model (A=0.25, I=250)", "url": None},
]
KNOWN = [("McMurdo Dry Valleys", (160.5, -78.0, 163.0, -77.2)),
         ("Haughton Crater (Devon Island)", (-91.0, 74.9, -88.0, 76.0))]
TEMP_UNIT = {
    "0-1m": ("K (surface skin temperature, mean daily; whole year and local summer)", "era5_land"),
    "1-5m": ("K (mean annual ground temperature, average of 2 m and 5 m)", "esa_cci_permafrost"),
    "gt5m": ("K (mean annual ground temperature at 10 m)", "esa_cci_permafrost"),
}
ICE_EARTH = {  # what the Earth ground-ice indicator means per layer
    "0-1m": "shallow_ice_certainty",
    "1-5m": "frozen_1_5m_certainty",
    "gt5m": "permafrost_fraction",
}
MARS_TEMP_KEYS = ("tmin", "tmax", "amp", "summer_tmin", "summer_tmax", "summer_amp", "t_1_5", "t_gt5")


def r3(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 3)


def known_analog(lon, lat):
    for name, (x0, y0, x1, y1) in KNOWN:
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            return name
    return None


def site_feature(s, layers):
    t = s["temperature"]
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
        "properties": {
            "id": s["id"], "name": s["name"], "window_deg": s["window_deg"], "coords_status": s["coords_status"],
            "coords_source": s["coords_source"],
            "features": {
                "temperature": {**{f"{q}_K": t[q] for q in MARS_TEMP_KEYS},
                                "unit": "K (surface: mean daily, whole Mars year and local summer; t_1_5 / t_gt5: annual-mean ground temperature at depth)",
                                "source": "mars_thermal_model"},
                "ground_ice": {lay: {"value": s["ice"][lay]["c"], "rank": s["ice"][lay]["percentile"]} for lay in layers}
                | {"unit": "SWIM ice consistency C (-1..1); rank among ice-consistent pixels", "source": "swim"},
                "polygons": {"value": s["polygons"]["value"], "rank": s["polygons"]["percentile"],
                             "status": s["polygons"]["status"],
                             "unit": "share of SWIM survey images showing HiRISE-scale polygons (0..1); rank among surveyed pixels",
                             "source": "swim"},
            },
            "chlorine_wt_pct": s["chlorine_wt_pct"],
            "description": s["description"], "citation": s["citation"],
        },
    }


def strengths_breaks(feats):
    ok = {k: v["score"] for k, v in feats.items() if v["status"] == "ok"}
    penalized = [k for k, v in feats.items() if v["status"] == "no_data_penalized"]
    if not ok:
        return [], penalized
    strengths = [k for k, v in sorted(ok.items(), key=lambda kv: -kv[1]) if v >= 0.8] or [max(ok, key=ok.get)]
    breaks = [k for k, v in sorted(ok.items(), key=lambda kv: kv[1]) if v < 0.5] + penalized
    return strengths, breaks


def score_png(path: Path, rows, cols, values):
    img = np.zeros((1800, 3600, 4), dtype=np.uint8)
    ok = np.isfinite(values)
    g = np.clip(np.round(values[ok] * 255), 0, 255).astype(np.uint8)
    for ch in range(3):
        img[rows[ok], cols[ok], ch] = g
    img[rows[ok], cols[ok], 3] = 255
    Image.fromarray(img, "RGBA").save(path, optimize=True)


def polygon_feature(sc, layer, b, k, site):
    if layer == "gt5m":
        return {"score": None, "earth_value": None, "mars_value": None, "unit": None,
                "status": "not_relevant", "source": None}
    # no SWIM polygon survey around this Mars site: counted as 0 (team rule: missing data in a feature
    # that counts is penalised)
    status = "ok" if site["polygons"]["status"] == "ok" else "no_data_penalized"
    return {
        "score": r3(sc["polygons"][b, k]),
        "earth_value": {"cracking_potential": r3(sc["crack"][k]), "ground_surface_temp_K": r3(sc["gst"][k])},
        "mars_value": {"swim_polygon_share": site["polygons"]["value"]},
        "unit": "compared by percentile on each planet; Earth value estimated from ground temperature, not observed",
        "status": status, "source": "esa_cci_permafrost+swim",
    }


def export_layer(interim: Path, out: Path, layer: str, sites: list) -> dict:
    with np.load(interim / f"scores_{layer}.npz") as z:  # materialise once: NpzFile re-reads on every access
        sc = {k: z[k] for k in z.files}
    windows_path = interim / f"experiment_window_{layer}.json"
    windows = json.loads(windows_path.read_text(encoding="utf-8")) if windows_path.exists() else {}
    places_path = interim / "places.json"
    places = json.loads(places_path.read_text(encoding="utf-8")) if places_path.exists() else {}
    site_ids = [s["id"] for s in sites]
    rows, cols = sc["rows"], sc["cols"]
    lat = 90 - (rows + 0.5) * RES
    lon = -180 + (cols + 0.5) * RES
    quantities = [str(q) for q in sc["temp_quantities"]]
    mars_keys = [str(q) for q in sc["temp_mars_keys"]]
    unit, temp_source = TEMP_UNIT[layer]

    top = np.argsort(-np.nan_to_num(sc["best"], nan=-1), kind="stable")[:TOP_N]
    feats_out = []
    for k in top:
        b = int(sc["best_site"][k])
        s = sites[b]
        cid = f"c_{lat[k]:.2f}_{lon[k]:.2f}"
        feats = {
            "temperature": {
                "score": r3(sc["temperature"][b, k]),
                "parts": {q: r3(sc["temp_parts"][b, j, k]) for j, q in enumerate(quantities)},
                "earth_value": {f"{q}_K": r3(sc["earth_temp"][j, k]) for j, q in enumerate(quantities)},
                "mars_value": {f"{q}_K": s["temperature"][mk] for q, mk in zip(quantities, mars_keys)},
                "unit": unit,
                "status": "ok" if np.isfinite(sc["temperature"][b, k]) else "no_data_penalized", "source": temp_source,
            },
            "ground_ice": {
                "score": r3(sc["ice"][b, k]),
                "earth_value": {ICE_EARTH[layer]: r3(sc["ice_earth"][k]), "active_layer_m": r3(sc["alt"][k]),
                                "permafrost_fraction": r3(sc["pfr"][k])},
                "mars_value": {"swim_c": s["ice"][layer]["c"]},
                "unit": "compared by percentile on each planet",
                "status": "ok", "source": "esa_cci_permafrost",
            },
            "polygons": polygon_feature(sc, layer, b, k, s),
        }
        strengths, breaks = strengths_breaks(feats)
        feats_out.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lon[k]), 2), round(float(lat[k]), 2)]},
            "properties": {
                "id": cid, "rank": int(sc["rank"][k]), "percentile": round(float(sc["percentile"][k]) * 100, 3),
                "score": r3(sc["best"][k]), "best_site_id": site_ids[b],
                # every site within 0.001 of the best score (deep layers often tie: all Mars sites are
                # colder than any Earth ground and several share the same SWIM value)
                "tied_site_ids": [sid for i, sid in enumerate(site_ids)
                                  if np.isfinite(sc["overall"][i, k]) and sc["best"][k] - sc["overall"][i, k] < 1e-3],
                "site_scores": {sid: r3(sc["overall"][i, k]) for i, sid in enumerate(site_ids)},
                "features": feats, "strengths": strengths, "breaks_down": breaks,
                "known_analog": known_analog(lon[k], lat[k]), "place": places.get(cid),
                "experiment_window": windows.get(cid),
            },
        })
    (out / f"cells_top_{layer}.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "layer": layer, "features": feats_out}, separators=(",", ":")), encoding="utf-8")

    maps = {"best": f"score_{layer}_best.png"}
    score_png(out / maps["best"], rows, cols, sc["best"])
    for i, sid in enumerate(site_ids):
        maps[sid] = f"score_{layer}_{sid}.png"
        score_png(out / maps[sid], rows, cols, sc["overall"][i])

    val = json.loads((interim / f"validation_{layer}.json").read_text(encoding="utf-8"))
    (out / f"validation_{layer}.json").write_text(json.dumps(val, indent=1), encoding="utf-8")
    print(layer, "top cells", len(feats_out), "windows", sum(1 for f in feats_out if f["properties"]["experiment_window"]))
    return {"cells_top": f"cells_top_{layer}.geojson", "score_maps": maps, "validation": f"validation_{layer}.json"}


def main(interim: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    sites = json.loads((interim / "mars_sites.json").read_text(encoding="utf-8"))
    done = [lay for lay, _ in LAYERS if (interim / f"scores_{lay}.npz").exists()]
    files = {lay: export_layer(interim, out, lay, sites) for lay in done}
    (out / "mars_sites.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "features": [site_feature(s, [lay for lay, _ in LAYERS]) for s in sites]},
        indent=1), encoding="utf-8")
    stale = out / "validation.json"  # replaced by validation_<layer>.json in contract 0.4
    if stale.exists():
        stale.unlink()
    manifest = {
        "contract_version": CONTRACT_VERSION,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mock": False,
        "cell_size_deg": RES,
        "layers": [{"id": lay, "label": label, "available": lay in done} for lay, label in LAYERS],
        "features": FEATURES,
        "sites": [s["id"] for s in sites],
        "files": {
            "mars_sites": "mars_sites.geojson",
            "cells_top": {lay: f["cells_top"] for lay, f in files.items()},
            "score_maps": {lay: f["score_maps"] for lay, f in files.items()},
            "validation": {lay: f["validation"] for lay, f in files.items()},
        },
        "sources": SOURCES,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", out, "layers", done)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
