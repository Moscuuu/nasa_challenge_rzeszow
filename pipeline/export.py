"""Write the GUI hand-off files (docs/contracts/analysis-to-gui/CONTRACT.md) into out/.

Exports every Depth Layer that has data/interim/scores_<layer>.npz, plus one shared manifest.

Usage: python pipeline/export.py data/interim out
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

import config as C

LAYERS = [("0-1m", "0–1 m (dry cover and ice table)"), ("1-5m", "1–5 m (shallow drilling)"),
          ("gt5m", "> 5 m (deep drilling)")]
RES = C.RES
CONTRACT_VERSION = "0.10"
FEATURES = [
    {"id": "temperature", "label": "Summer surface temperature (midday, clear sky)", "comparison": "direct"},
    {"id": "ground_ice", "label": "Depth to never-thawing ground (filter only, not scored)", "comparison": "filter"},
    {"id": "dryness", "label": "Dryness (dry cover vs wet tundra)", "comparison": "rank"},
    {"id": "bare_ground", "label": "Bare ground in summer (no snow or ice cover)", "comparison": "monotone"},
]
FEATURE_KEY = {"temperature": "summer_temperature", "ground_ice": "ice_table", "dryness": "dryness",
               "bare_ground": "bare_ground"}  # contract id -> score.py name
REGION_TYPES = [
    {"id": "northern", "label": "Arctic and northern permafrost",
     "caveats": ["Ground temperature and thaw depth are model output (ESA Permafrost CCI), not measurements."]},
    {"id": "antarctic", "label": "Antarctic ice-free ground",
     "caveats": ["Thaw depth from CCI is ~0 m everywhere here, a known underestimate (it is only a filter).",
                 "CCI cannot tell dry-frozen ground (no ice) from ice-cemented ground.",
                 "No SMAP soil wetness on permanent ice: dryness rests on precipitation alone."]},
    {"id": "pzi_only", "label": "Outside CCI coverage, PZI map only (Andes, other mountains, Arctic coast gaps)",
     "caveats": ["Ground temperature = PZI air temperature + 2 K (assumed), not a ground product.",
                 "No thaw depth: the thaw-depth filter does not apply here.",
                 "Ground temperature is the same for all Depth Layers (one PZI air temperature per cell).",
                 "ERA5-Land precipitation is known to be too high in high mountains."]},
]
SOURCES = [
    {"id": "pzi", "label": "Global Permafrost Zonation Index, 1 km (Gruber 2012): permafrost mask, air temperature", "url": "https://doi.org/10.5194/tc-6-221-2012"},
    {"id": "esa_cci_permafrost", "label": "ESA Permafrost CCI v5.0 (ground temperature, active-layer thickness; mask in Antarctica), 2023", "url": "https://climate.esa.int/en/projects/permafrost/"},
    {"id": "modis_lst", "label": "NASA MODIS Aqua MYD11A1 v6.1 daytime land surface temperature, 1 km, local summer 2023, over the cell's snow-free permafrost pixels (via Google Earth Engine)", "url": "https://doi.org/10.5067/MODIS/MYD11A1.061"},
    {"id": "era5_land", "label": "ERA5-Land daily aggregates (ECMWF, via Google Earth Engine), 2023: precipitation (dryness)", "url": "https://doi.org/10.24381/cds.e2161bac"},
    {"id": "smap_l4", "label": "NASA SMAP L4 SPL4SMGP v8 (via Google Earth Engine), 2023", "url": "https://doi.org/10.5067/T5RUATAQREF8"},
    {"id": "modis", "label": "NASA MODIS MOD10A1 v6.1 snow cover and MCD12Q1 v6.1 land cover (via Google Earth Engine), 2023", "url": "https://doi.org/10.5067/MODIS/MOD10A1.061"},
    {"id": "swim", "label": "SWIM4MIM ice consistency composites (PSI / NASA)", "url": "https://swim.psi.edu"},
    {"id": "mars_thermal_model", "label": "Team 1-D Mars surface thermal model (A=0.25, I=250)", "url": None},
]
KNOWN = [(name, box) for name, role, box in C.CHECK_BOXES if role == "known_analog"]
MARS_TEMP_KEYS = ("tmin", "tmax", "amp", "summer_tmin", "summer_tmax", "summer_amp", "t_1_5", "t_gt5")
TEMP_SOURCE = {0: None, 1: "esa_cci_permafrost", 2: "pzi"}


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
    ok = {k: v["score"] for k, v in feats.items() if v["status"] == "ok" and v["score"] is not None}
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


def cell_features(sc, b, k, site, used):
    """Feature blocks of one cell against one Mars site. A feature its region type does not rank on
    keeps its values but has status "not_relevant" and no score."""
    def block(fid, earth, mars, unit, source, extra=None):
        on = FEATURE_KEY[fid] in used
        return {"score": r3(sc[f"feat_{FEATURE_KEY[fid]}"][b, k]) if on else None, **(extra or {}),
                "earth_value": earth, "mars_value": mars, "unit": unit,
                "status": "ok" if on else "not_relevant", "source": source}

    return {
        "temperature": block(
            "temperature", {"summer_tmax_K": r3(sc["summer_tmax"][k])},
            {"summer_tmax_K": site["temperature"]["summer_tmax"]},
            "K, local summer. Earth: MODIS daytime surface temperature (~13:30, clear sky) over the cell's permafrost "
            "pixels. Mars: mean daily maximum. Compared in kelvin, 20 K apart = 0",
            "modis_lst"),
        "ground_ice": block(
            "ground_ice", {"active_layer_m": r3(sc["alt"][k]), "ground_temperature_K": r3(sc["t_ground"][k])},
            {"swim_c": site["ice"][str(sc["layer"])]["c"]},
            "Not scored (filter only: summer thaw depth <= 0.5 m where CCI knows it). Earth: thaw depth [m] and ground "
            "temperature of this Depth Layer [K]. Mars: SWIM ice consistency of this Depth Layer (context)",
            "esa_cci_permafrost"),
        "dryness": block(
            "dryness", {"precip_mm_yr": r3(sc["precip_mm_yr"][k]), "wet_summer": r3(sc["wet_summer"][k])},
            {"precip_mm_yr": 0.0, "wet_summer": 0.0},
            "ranked among cells that passed the filters, driest = 1; wet_summer = SMAP surface wetness "
            "(fraction of saturation)", "smap_l4",
            {"parts": {"precip_mm_yr": r3(sc["dry_parts"][0, k]), "wet_summer": r3(sc["dry_parts"][1, k])}}),
        "bare_ground": block(
            "bare_ground", {"snow_free_summer": r3(sc["snow_free_summer"][k])}, {"snow_free_summer": 1.0},
            "share of cloud-free summer observations without snow (0..1)", "modis"),
    }


def export_layer(interim: Path, out: Path, layer: str, sites: list) -> dict:
    with np.load(interim / f"scores_{layer}.npz") as z:  # materialise once: NpzFile re-reads on every access
        sc = {k: z[k] for k in z.files}
    windows_path = interim / f"experiment_window_{layer}.json"
    windows = json.loads(windows_path.read_text(encoding="utf-8")) if windows_path.exists() else {}
    places_path = interim / "places.json"
    places = json.loads(places_path.read_text(encoding="utf-8")) if places_path.exists() else {}
    site_ids = [s["id"] for s in sites]
    site_ok = sc["site_ok"]
    rows, cols = sc["rows"], sc["cols"]
    lat = 90 - (rows + 0.5) * RES
    lon = -180 + (cols + 0.5) * RES
    cid = lambda k: f"c_{lat[k]:.2f}_{lon[k]:.2f}"  # noqa: E731

    top = sc["top"][np.argsort(sc["rank"][sc["top"]], kind="stable")]
    feats_out = []
    for k in top:
        b = int(sc["best_site"][k])
        rtype = C.REGION_TYPES[int(sc["region"][k])]
        feats = cell_features(sc, b, k, sites[b], C.TYPE_FEATURES[rtype])
        strengths, breaks = strengths_breaks(feats)
        scores = {sid: (r3(sc["overall"][i, k]) if site_ok[i] else None) for i, sid in enumerate(site_ids)}
        feats_out.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lon[k]), 2), round(float(lat[k]), 2)]},
            "properties": {
                "id": cid(k), "rank": int(sc["rank"][k]), "percentile": round(float(sc["percentile"][k]) * 100, 3),
                "score": r3(sc["best"][k]), "best_site_id": site_ids[b],
                # every applicable site within 0.001 of the best score. Ties are the rule: only summer
                # temperature differs between Mars sites, and six of the seven are within 6 K of each other.
                "tied_site_ids": [sid for sid, v in scores.items() if v is not None and sc["best"][k] - v < 1e-3],
                "site_scores": scores,
                "region_type": rtype, "type_rank": int(sc["type_rank"][k]),
                "type_percentile": round(float(sc["type_percentile"][k]) * 100, 3),
                "stability": r3(sc["stability"][k]), "area_id": f"a_{layer}_{int(sc['area'][k])}",
                "ground_temperature_source": TEMP_SOURCE[int(sc["temp_source"][k])],
                "features": feats, "strengths": strengths, "breaks_down": breaks,
                "known_analog": known_analog(lon[k], lat[k]), "place": places.get(cid(k)),
                "experiment_window": windows.get(cid(k)),
            },
        })
    (out / f"cells_top_{layer}.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "layer": layer, "features": feats_out}, separators=(",", ":")), encoding="utf-8")

    # Areas: groups of top cells, at most AREA_MAX_CELLS x AREA_MAX_CELLS; the point is the best cell.
    areas = []
    for a in range(int(sc["area"].max()) + 1):
        idx = np.nonzero(sc["area"] == a)[0]
        k = idx[np.argmax(sc["best"][idx])]
        areas.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(lon[k]), 2), round(float(lat[k]), 2)]},
            "properties": {
                "id": f"a_{layer}_{a}", "region_type": C.REGION_TYPES[int(sc["region"][k])],
                "cells": int(idx.size), "cell_ids": [cid(j) for j in idx[np.argsort(-sc["best"][idx])]],
                "best_cell_id": cid(k), "place": places.get(cid(k)),
                "bbox": [round(float(lon[idx].min() - RES / 2), 2), round(float(lat[idx].min() - RES / 2), 2),
                         round(float(lon[idx].max() + RES / 2), 2), round(float(lat[idx].max() + RES / 2), 2)],
                "score_best": r3(sc["best"][k]), "score_mean": r3(sc["best"][idx].mean()),
                "type_rank_best": int(sc["type_rank"][k]), "stability_mean": r3(sc["stability"][idx].mean()),
                "best_site_id": site_ids[int(sc["best_site"][k])],
                "known_analog": known_analog(lon[k], lat[k]),
            },
        })
    areas.sort(key=lambda f: -f["properties"]["score_best"])
    (out / f"areas_{layer}.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "layer": layer, "features": areas}, separators=(",", ":")), encoding="utf-8")

    maps = {"best": f"score_{layer}_best.png"}
    score_png(out / maps["best"], rows, cols, sc["best"])
    for i, sid in enumerate(site_ids):
        maps[sid] = f"score_{layer}_{sid}.png"
        # a site without SWIM ice in this Depth Layer gets an empty map: nothing to be an analog of
        score_png(out / maps[sid], rows, cols, sc["overall"][i] if site_ok[i] else np.full(rows.size, np.nan))

    val = json.loads((interim / f"validation_{layer}.json").read_text(encoding="utf-8"))
    (out / f"validation_{layer}.json").write_text(json.dumps(val, indent=1), encoding="utf-8")
    print(layer, "top cells", len(feats_out), "areas", len(areas),
          "windows", sum(1 for f in feats_out if f["properties"]["experiment_window"]))
    return {"cells_top": f"cells_top_{layer}.geojson", "areas": f"areas_{layer}.geojson", "score_maps": maps,
            "validation": f"validation_{layer}.json",
            "sites": [sid for i, sid in enumerate(site_ids) if site_ok[i]], "n_variants": int(sc["n_variants"])}


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
        "region_types": [{**t, "features": [fid for fid, name in FEATURE_KEY.items() if name in C.TYPE_FEATURES[t["id"]]]}
                         for t in REGION_TYPES],
        "filters": {"ground_temperature_max_K": C.T_GROUND_MAX_K, "active_layer_max_m": C.ALT_MAX_M,
                    "snow_free_summer_min": C.SNOW_FREE_MIN, "ice_fraction_max": C.ICE_FRACTION_MAX},
        "robustness": {"variants": max((f["n_variants"] for f in files.values()), default=0),
                       "meaning": "stability = share of variants (-5 / -10 C, thaw depth 0.5 / 1.0 m, each feature "
                                  "left out in turn) in which the cell is in the top 10 % of its region type"},
        "sites": [s["id"] for s in sites],
        "layer_sites": {lay: f["sites"] for lay, f in files.items()},
        "files": {
            "mars_sites": "mars_sites.geojson",
            "cells_top": {lay: f["cells_top"] for lay, f in files.items()},
            "areas": {lay: f["areas"] for lay, f in files.items()},
            "score_maps": {lay: f["score_maps"] for lay, f in files.items()},
            "validation": {lay: f["validation"] for lay, f in files.items()},
        },
        "sources": SOURCES,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", out, "layers", done)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
