# data/ — shared data snapshot (2026-11-14)

This branch (`data-snapshot`) holds only the `data/` folder. It has no code history.
On `main`, `data/` is in `.gitignore`, so it never mixes with code commits.

## How to get it (from your normal checkout on main)

```bash
git fetch origin data-snapshot
git checkout origin/data-snapshot -- data/   # copies files into data/
git reset -q data/                  # unstage them again (data/ stays ignored)
```

## What is inside

| folder | planet | what | used by |
|---|---|---|---|
| `raw/cci/` | Earth | ESA Permafrost CCI v5, 2023: PFR (permafrost %), ALT (thaw depth), N hemisphere (AREA4) + Antarctica (AREA27) | `pipeline/fetch_cci.py`, `earth_grid.py` |
| `interim/` | both | 0.1° Earth grid, ERA5-Land skin temp 2023 (tmin/tmax/amp), Mars sites, scores, validation | `pipeline/*` |
| `swim/` | Mars | SWIM4MIM ice consistency C (0–1 m, 1–5 m, >5 m) + polygons map | `pipeline/fetch_swim.py`, `mars_sites.py` |
| `nsidc_ggd318/` | Earth | NSIDC circum-Arctic permafrost & ground-ice map (shapefile + 12.5 km raster) | `analysis/nsidc_ggd318/` (not used by pipeline) |
| `permafrost_cci/` | Earth | CCI gridded to 0.1° (csv.gz) | branch `combine-score` |
| `dryness/` | Earth | precipitation + NDVI 0.1° grid | branch `combine-score` |
| `combine/` | both | combined score outputs | branch `combine-score` |
| `smap_l4/`, `smap_l4_test/` | Earth | only AppEEARS task records; **no SMAP data** (request returned nothing) | `analysis/smap/` |

Sources and licences: see `analysis/*/..._podsumowanie.md` on main. NASA data is public domain;
ESA CCI and SWIM require citation.
