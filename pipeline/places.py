"""Name the exported Earth Cells: "<most specific physical region>, <country>" from Natural Earth 10m.

Physical region = the smallest Natural Earth geography-region polygon containing the cell centre
(ranges, plateaus, islands, deserts...). Country = admin-0 polygon containing the centre.
Covers the top cells of every scored Depth Layer.

Output: data/interim/places.json  {cell_id: "Verkhoyansk Range, Russia"}

Usage: python -I pipeline/places.py data/raw/naturalearth data/interim
"""
import json
import sys
from pathlib import Path

import numpy as np
import pyogrio.raw
import shapely
from shapely import STRtree

RES = 0.1
TOP_N = 2000


def load(path: Path, name_fields: tuple) -> tuple[np.ndarray, list]:
    meta, _, geoms, fields = pyogrio.raw.read(path)
    cols = list(meta["fields"])
    names = None
    for f in name_fields:  # first non-empty field wins
        vals = fields[cols.index(f)]
        names = vals if names is None else np.where([bool(n) for n in names], names, vals)
    return shapely.from_wkb(geoms), [str(n) if n else None for n in names]


def main(ne_dir: Path, interim: Path) -> None:
    regions, region_names = load(ne_dir / "ne_10m_geography_regions_polys/ne_10m_geography_regions_polys.shp",
                                 ("NAME_EN", "NAME"))
    countries, country_names = load(ne_dir / "ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp",
                                    ("NAME_EN", "NAME"))
    region_area = shapely.area(regions)
    rtree, ctree = STRtree(regions), STRtree(countries)

    cells = {}
    for layer in ("0-1m", "1-5m", "gt5m"):
        path = interim / f"scores_{layer}.npz"
        if not path.exists():
            continue
        with np.load(path) as z:
            best, rows, cols = z["best"], z["rows"], z["cols"]
        top = np.argsort(-np.nan_to_num(best, nan=-1), kind="stable")[:TOP_N]
        for k in top:
            lat, lon = 90 - (rows[k] + 0.5) * RES, -180 + (cols[k] + 0.5) * RES
            cells[f"c_{lat:.2f}_{lon:.2f}"] = (lon, lat)

    ids = list(cells)
    pts = shapely.points(np.array([cells[i] for i in ids]))
    out = {}
    r_hits = rtree.query(pts, predicate="within")  # (point index, region index)
    c_hits = ctree.query(pts, predicate="within")
    best_region = {}
    for p, r in zip(*r_hits):
        if p not in best_region or region_area[r] < region_area[best_region[p]]:
            best_region[p] = r
    country = {p: c for p, c in zip(*c_hits)}
    for p, cid in enumerate(ids):
        parts = []
        if p in best_region and region_names[best_region[p]]:
            parts.append(region_names[best_region[p]])
        if p in country and country_names[country[p]]:
            parts.append(country_names[country[p]])
        out[cid] = ", ".join(dict.fromkeys(parts)) or None
    (interim / "places.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    named = sum(1 for v in out.values() if v)
    print("cells", len(out), "named", named)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
