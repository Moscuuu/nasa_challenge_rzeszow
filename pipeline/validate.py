"""Check the method on places with a known answer. This is a sanity check, not proof of Mars-likeness.

Percentiles are taken among the cells that passed the filters, inside the cell's region type. (Ranking
against all permafrost would put every cell that passes the filters above ~80 % and make the check empty.)

  known_analog  median percentile of the box's / point's scored cells must be >= 90
  contrast      wet or warm permafrost: median over ALL its cells must be < 50, a cell that fails the
                filters counting as 0 (rejected)

Every check is also run with a "cold only" score (colder ground = better, same cells). If cold alone does
as well, the features add nothing there; the result says so instead of hiding it.

Points use the 3 x 3 cells around the coordinate: valleys are narrower than a cell.

Output: data/interim/validation_<layer>.json (copied to out/ by export.py)

Usage: python pipeline/validate.py data/interim [0-1m|1-5m|gt5m]
"""
import json
import sys
from pathlib import Path

import numpy as np

import config as C
from score import rank01

LAYER = sys.argv[2] if len(sys.argv) > 2 else "0-1m"  # Depth Layer


def main(interim: Path) -> None:
    sc = np.load(interim / f"scores_{LAYER}.npz")
    lat = 90 - (sc["rows"] + 0.5) * C.RES
    lon = -180 + (sc["cols"] + 0.5) * C.RES
    scored, region = sc["scored"], sc["region"]
    pct = sc["type_percentile"] * 100
    cold = np.full(pct.shape, np.nan)  # cold-only baseline, same cells, same region types
    for r in range(len(C.REGION_TYPES)):
        sel = scored & (region == r)
        cold[sel] = rank01(-sc["t_ground"][sel]) * 100

    def check(name, role, sel, bbox, kind):
        n, n_scored = int(sel.sum()), int((sel & scored).sum())
        if role == "known_analog":
            med = float(np.median(pct[sel & scored])) if n_scored else None
            med_cold = float(np.median(cold[sel & scored])) if n_scored else None
            passed = med is not None and med >= 90
        else:
            med = float(np.median(np.where(scored[sel], pct[sel], 0.0))) if n else None
            med_cold = float(np.median(np.where(scored[sel], cold[sel], 0.0))) if n else None
            passed = med is not None and med < 50
        out = {"name": name, "role": role, "kind": kind, "bbox": bbox, "cells": n, "cells_scored": n_scored,
               "median_percentile": None if med is None else round(med, 1),
               "cold_only_percentile": None if med_cold is None else round(med_cold, 1),
               "passed": bool(passed), "applicable": True}
        print(f"{name:34s} {role:13s} cells {n:5d} scored {n_scored:5d}  median pct {out['median_percentile']}  "
              f"cold only {out['cold_only_percentile']}  passed {passed}")
        return out

    checks = []
    for name, role, (x0, y0, x1, y1) in C.CHECK_BOXES:
        sel = (lon >= x0) & (lon <= x1) & (lat >= y0) & (lat <= y1)
        checks.append(check(name, role, sel, [x0, y0, x1, y1], "box"))
    for name, role, la, lo in C.CHECK_POINTS:
        dx = 1.5 * C.RES
        sel = (np.abs(lat - la) <= dx) & (np.abs(lon - lo) <= dx)
        checks.append(check(name, role, sel, [round(lo - dx, 2), round(la - dx, 2), round(lo + dx, 2), round(la + dx, 2)],
                            "point"))

    n_all, n_scored = int(scored.size), int(scored.sum())
    out = {
        "layer": LAYER, "checks": checks,
        "cells": {"permafrost": n_all, "pass_filters": int(sc["eligible"].sum()), "scored": n_scored},
        "weights": {},  # kept for older GUI builds; feature sets per region type are in manifest.region_types
        "feature_correlation": json.loads(str(sc["spearman"])),
        "notes": ("Percentile = position among the cells of the same region type that passed the filters. "
                  "A contrast cell that fails the filters counts as 0. cold_only_percentile is the same check "
                  "with 'colder ground = better' as the score: where it is as high as median_percentile, the "
                  "features add nothing beyond cold. Sanity check on a handful of places, not proof."),
    }
    (interim / f"validation_{LAYER}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    known = [c for c in checks if c["role"] == "known_analog"]
    contrast = [c for c in checks if c["role"] == "contrast"]
    print(f"known analogs passed {sum(c['passed'] for c in known)}/{len(known)}, "
          f"contrasts passed {sum(c['passed'] for c in contrast)}/{len(contrast)}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
