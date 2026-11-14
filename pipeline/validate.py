"""Check the method: Known Analogs must land in the top 10 % of permafrost cells, the wet-tundra contrast below 50 %.

Output: data/interim/validation_0-1m.json (copied to out/validation.json by export.py)

Usage: python -I pipeline/validate.py data/interim
"""
import json
import sys
from pathlib import Path

import numpy as np

LAYER = "0-1m"
RES = 0.1
CHECKS = [  # name, role, (lon0, lat0, lon1, lat1)
    ("McMurdo Dry Valleys", "known_analog", (160.5, -78.0, 163.0, -77.2)),
    ("Haughton Crater (Devon Island)", "known_analog", (-91.0, 74.9, -88.0, 76.0)),
    ("Alaska North Slope", "contrast", (-160.0, 69.0, -145.0, 71.0)),
]


def main(interim: Path) -> None:
    sc = np.load(interim / f"scores_{LAYER}.npz")
    lat = 90 - (sc["rows"] + 0.5) * RES
    lon = -180 + (sc["cols"] + 0.5) * RES
    checks = []
    for name, role, (x0, y0, x1, y1) in CHECKS:
        sel = (lon >= x0) & (lon <= x1) & (lat >= y0) & (lat <= y1)
        p = sc["percentile"][sel] * 100
        med = float(np.nanmedian(p)) if sel.any() else None
        passed = None if med is None else (med >= 90 if role == "known_analog" else med < 50)
        checks.append({"name": name, "role": role, "cells": int(sel.sum()),
                       "median_percentile": None if med is None else round(med, 1), "passed": passed})
        print(f"{name:32s} {role:13s} cells {int(sel.sum()):5d}  median pct {med if med is None else round(med, 1)}  passed {passed}")
    out = {"layer": LAYER, "checks": checks,
           "weights": {"temperature": 0.5, "ground_ice": 0.5, "polygons": 0.0},
           "notes": "Polygons not yet included in the score. Percentile = position of the cell's best score among all permafrost cells."}
    (interim / f"validation_{LAYER}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
