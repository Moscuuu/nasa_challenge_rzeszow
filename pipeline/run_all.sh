#!/usr/bin/env bash
# Full analysis pipeline: downloads -> grids -> Mars sites -> scores per Depth Layer -> GUI hand-off in out/.
# Needs: pip install -r requirements.txt, an Earth Engine service-account key (scripts/ee_init.py),
# ~7 GB disk for data/raw (PZI is 2 x 3.1 GB). Spec: docs/superpowers/specs/2026-11-15-drilling-analog-design.md
set -euo pipefail
cd "$(dirname "$0")/.."

python pipeline/fetch_cci.py data/raw/cci
python pipeline/fetch_pzi.py data/raw/pzi                              # 6.2 GB, public
python pipeline/fetch_swim.py data/raw/swim 0_1 1_5 5 landforms
python pipeline/fetch_era5.py data/interim/era5_skin_2023.npz          # Earth Engine, ~15 min
python pipeline/fetch_smap.py data/interim/dryness_2023.npz            # Earth Engine: SMAP L4 wetness + ERA5-Land precip
python pipeline/earth_grid.py data/raw/cci data/raw/pzi data/interim/earth_grid.npz
python pipeline/fetch_surface.py data/interim/surface_2023.npz data/interim/earth_grid.npz   # Earth Engine: MODIS snow, ice
(cd pipeline && python mars_sites.py ../data/raw/swim ../data/interim/mars_sites.json)       # imports mars_thermal

for layer in 0-1m 1-5m gt5m; do
  python pipeline/score.py data/interim "$layer"
  python pipeline/validate.py data/interim "$layer"
  python pipeline/experiment_window.py data/interim "$layer"            # Earth Engine, ~5-10 min per layer
done

python pipeline/fetch_places.py data/raw/naturalearth
python pipeline/places.py data/raw/naturalearth data/interim
python pipeline/export.py data/interim out
