# data/ — shared data snapshot (2026-11-14)

These files are tracked in git on `main` (snapshot from 2026-11-14).
`data/` is still in `.gitignore`, so only these files are tracked; new files you
create in `data/` stay local.

## How to get it

Just `git pull` on `main`.

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
