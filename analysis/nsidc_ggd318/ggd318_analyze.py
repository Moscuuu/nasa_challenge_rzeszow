"""Decode NSIDC GGD318 (Brown et al. permafrost + ground-ice map) and summarise it per region
and on a global 0.1 deg grid.

Outputs (in --out):
    regions.csv          per region: area share of each permafrost-extent and ground-ice class
    grid_0p1deg.csv.gz   0.1 deg lat/lon cells (north of 20N) that hit permafrost or glacier,
                         with decoded classes, for the global similarity pipeline
    map_regions.png      map of extent x ground ice with region boxes

Classes (map legend, Brown et al. 1997/2002):
    EXTENT   C continuous 90-100 % | D discontinuous 50-90 % | S sporadic 10-50 % | I isolated <10 %
    CONTENT  visible ground ice, upper 10-20 m, % by volume
             landform f (lowlands, thick overburden):   h >20 %, m 10-20 %, l <10 %
             landform r (mountains, thin overburden):   h >10 %,            l <10 %
    COMBO    g glacier | l lake | o ocean/inland sea | r relict permafrost | ld land, no permafrost

Usage:
    pip install geopandas pyogrio shapely pyproj matplotlib
    python ggd318_analyze.py --data data/nsidc_ggd318 --out data/nsidc_ggd318/out
    python ggd318_analyze.py --no-grid   # skip the 0.1 deg grid (slowest step, ~1 min)
"""
import argparse
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box

# Same regions as analysis/smap (SMAP_podsumowanie.md, section 4), plus extra NH candidates.
REGIONS = {
    "dry_valleys": (160.5, -78.0, 163.0, -77.2),        # known analog; outside the map (SH)
    "qiangtang": (82.0, 33.0, 90.0, 36.0),              # main Phoenix candidate
    "ojos_del_salado": (-69.5, -28.0, -67.5, -26.0),    # outside the map (SH)
    "axel_heiberg": (-95.0, 78.5, -88.0, 81.0),
    "alaska_north_slope": (-160.0, 69.0, -145.0, 71.0),  # contrast: wet tundra
    "devon_island_haughton": (-90.5, 75.0, -88.5, 75.8),  # known Mars analog (Haughton crater)
    "svalbard_bockfjord": (13.0, 79.2, 14.5, 79.6),     # known Mars analog (AMASE)
}

EXTENT_FRAC = {"C": 0.95, "D": 0.70, "S": 0.30, "I": 0.05}  # midpoints of the class ranges
EXTENT_NAME = {"C": "continuous", "D": "discontinuous", "S": "sporadic", "I": "isolated"}
ICE_ORD = {"l": 1, "m": 2, "h": 3}  # ordinal; % ranges depend on landform, so no midpoints
ICE_NAME = {"l": "low", "m": "medium", "h": "high"}


def load(data_dir: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(data_dir / "permaice.shp")
    g["glacier"] = g["COMBO"].eq("g")
    g["water"] = g["COMBO"].isin(["l", "o"])
    g["relict"] = g["COMBO"].eq("r") | g["RELICT"].eq("yes")
    g["extent"] = g["EXTENT"].map(EXTENT_NAME)
    g["pf_frac"] = g["EXTENT"].map(EXTENT_FRAC)
    g["ice"] = g["CONTENT"].map(ICE_NAME)
    g["ice_ord"] = g["CONTENT"].map(ICE_ORD)
    g["landform"] = g["LANDFORM"].map({"f": "lowland_thick", "r": "mountain_thin"})
    return g


def lonlat_box(lon0, lat0, lon1, lat1, crs, n=50):
    """bbox in lon/lat, densified so its edges follow parallels/meridians after projection."""
    b = box(lon0, lat0, lon1, lat1).segmentize(max((lon1 - lon0), (lat1 - lat0)) / n)
    return gpd.GeoSeries([b], crs="EPSG:4326").to_crs(crs).iloc[0]


def region_stats(g: gpd.GeoDataFrame) -> pd.DataFrame:
    rows = []
    sidx = g.sindex
    for name, (lon0, lat0, lon1, lat1) in REGIONS.items():
        row = {"region": name, "bbox": f"{lon0},{lat0},{lon1},{lat1}"}
        if lat1 < 20:
            row["note"] = "outside map (northern hemisphere only)"
            rows.append(row)
            continue
        poly = lonlat_box(lon0, lat0, lon1, lat1, g.crs)
        sub = g.iloc[sidx.query(poly, predicate="intersects")].copy()
        sub["geometry"] = sub.geometry.intersection(poly)
        sub["a"] = sub.area / 1e6  # km2
        total = poly.area / 1e6
        mapped = sub["a"].sum()
        land = sub.loc[~sub["water"], "a"].sum()
        row.update(area_km2=round(total), mapped_frac=round(mapped / total, 3))
        row["glacier_frac"] = round(sub.loc[sub["glacier"], "a"].sum() / land, 3) if land else np.nan
        # extent / ice shares over non-glacier, non-water land
        ground = sub[~sub["water"] & ~sub["glacier"]]
        ga = ground["a"].sum()
        for code, nm in EXTENT_NAME.items():
            row[f"ext_{nm}"] = round(ground.loc[ground["EXTENT"] == code, "a"].sum() / ga, 3) if ga else np.nan
        row["ext_none"] = round(ground.loc[ground["EXTENT"].isna(), "a"].sum() / ga, 3) if ga else np.nan
        for code, nm in ICE_NAME.items():
            row[f"ice_{nm}"] = round(ground.loc[ground["CONTENT"] == code, "a"].sum() / ga, 3) if ga else np.nan
        # area-weighted indicators
        w = ground["a"]
        row["pf_frac_mean"] = round((ground["pf_frac"].fillna(0) * w).sum() / ga, 3) if ga else np.nan
        row["ice_ord_mean"] = round((ground["ice_ord"].fillna(0) * w).sum() / ga, 2) if ga else np.nan
        # Phoenix-like ground: continuous permafrost with high ground-ice content
        pl = ground[(ground["EXTENT"] == "C") & (ground["CONTENT"] == "h")]["a"].sum()
        row["phoenix_like_frac"] = round(pl / ga, 3) if ga else np.nan
        row["mountain_frac"] = round(ground.loc[ground["LANDFORM"] == "r", "a"].sum() / ga, 3) if ga else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def grid(g: gpd.GeoDataFrame, step=0.1, lat_min=20.0) -> pd.DataFrame:
    lats = np.arange(lat_min + step / 2, 90, step)
    lons = np.arange(-180 + step / 2, 180, step)
    LON, LAT = np.meshgrid(lons, lats)
    pts = gpd.GeoDataFrame(
        {"lat": LAT.ravel().round(3), "lon": LON.ravel().round(3)},
        geometry=gpd.points_from_xy(LON.ravel(), LAT.ravel()), crs="EPSG:4326",
    ).to_crs(g.crs)
    keep = g[g["EXTENT"].notna() | g["glacier"] | g["relict"]]
    cols = ["extent", "pf_frac", "ice", "ice_ord", "landform", "glacier", "relict"]
    j = gpd.sjoin(pts, keep[cols + ["geometry"]], how="inner", predicate="within")
    j = j[~j.index.duplicated()]  # points on shared borders
    return pd.DataFrame(j[["lat", "lon"] + cols]).reset_index(drop=True)


def plot(g: gpd.GeoDataFrame, out: Path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch

    colors = {  # extent x ice
        ("C", "h"): "#08306b", ("C", "m"): "#2171b5", ("C", "l"): "#6baed6",
        ("D", "h"): "#3f007d", ("D", "m"): "#6a51a3", ("D", "l"): "#9e9ac8",
        ("S", None): "#fdae6b", ("I", None): "#fee6ce",
    }

    def col(r):
        if r["glacier"]:
            return "#e0f3f8"
        if pd.isna(r["EXTENT"]):
            return "#f0f0f0" if not r["water"] else "#c6dbef"
        if r["EXTENT"] in ("S", "I"):
            return colors[(r["EXTENT"], None)]
        return colors.get((r["EXTENT"], r["CONTENT"]), "#999999")

    fig, ax = plt.subplots(figsize=(10, 10))
    g.plot(ax=ax, color=g.apply(col, axis=1), linewidth=0)
    for name, (lon0, lat0, lon1, lat1) in REGIONS.items():
        if lat1 < 20:
            continue
        b = gpd.GeoSeries([lonlat_box(lon0, lat0, lon1, lat1, g.crs)], crs=g.crs)
        b.boundary.plot(ax=ax, color="red", linewidth=1.5)
        c = b.iloc[0].centroid
        ax.annotate(name, (c.x, c.y), color="red", fontsize=8, xytext=(4, 4), textcoords="offset points")
    legend = [Patch(color=v, label=f"{k[0]} / ice {k[1] or 'n/a'}") for k, v in colors.items()]
    legend.append(Patch(color="#e0f3f8", label="glacier"))
    ax.legend(handles=legend, loc="lower left", fontsize=7, title="extent / ground ice")
    ax.set_title("NSIDC GGD318: permafrost extent x ground-ice content (Brown et al. 2002)")
    ax.set_axis_off()
    fig.savefig(out, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data/nsidc_ggd318")
    ap.add_argument("--out", default="data/nsidc_ggd318/out")
    ap.add_argument("--no-grid", action="store_true")
    ap.add_argument("--no-plot", action="store_true")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    g = load(Path(args.data))
    print(f"{len(g)} polygons, CRS: {g.crs.name}")

    reg = region_stats(g)
    reg.to_csv(out / "regions.csv", index=False)
    with pd.option_context("display.width", 250, "display.max_columns", 30):
        print(reg.drop(columns=["bbox"]).to_string(index=False))

    if not args.no_grid:
        gr = grid(g)
        gr.to_csv(out / "grid_0p1deg.csv.gz", index=False)
        print(f"grid: {len(gr)} cells with permafrost/glacier -> {out / 'grid_0p1deg.csv.gz'}")
    if not args.no_plot:
        plot(g, out / "map_regions.png")
        print(f"map -> {out / 'map_regions.png'}")


if __name__ == "__main__":
    main()
