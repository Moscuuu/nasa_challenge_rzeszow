#!/usr/bin/env bash
# Full analysis pipeline: downloads -> grids -> Mars sites -> scores per Depth Layer -> GUI hand-off in out/.
# Needs: Earth Engine auth (ADC), ~1 GB disk for data/raw. See docs/superpowers/specs/2026-11-14-permafrost-analog-analysis-design.md
set -euo pipefail
cd "$(dirname "$0")/.."

python -I pipeline/fetch_cci.py data/raw/cci
python -I pipeline/fetch_swim.py data/raw/swim 0_1 1_5 5 landforms
python pipeline/fetch_era5.py data/interim/era5_skin_2023.npz          # Earth Engine, ~15 min
python -I pipeline/earth_grid.py data/raw/cci data/interim/earth_grid.npz
(cd pipeline && python mars_sites.py ../data/raw/swim ../data/interim/mars_sites.json)   # imports mars_thermal

for layer in 0-1m 1-5m gt5m; do
  python -I pipeline/score.py data/interim "$layer"
  python -I pipeline/validate.py data/interim "$layer"
  python pipeline/experiment_window.py data/interim "$layer"            # Earth Engine, ~5-10 min per layer
done

python -I pipeline/export.py data/interim out
