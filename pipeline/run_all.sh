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

# Optional: NSIDC GGD318 ground-ice content for the deeper layers (needs NASA Earthdata login in ~/_netrc
# or EARTHDATA_USERNAME / EARTHDATA_PASSWORD). Skipped when the login is missing.
if python analysis/nsidc_ggd318/ggd318_fetch.py --out data/nsidc_ggd318; then
  python analysis/nsidc_ggd318/ggd318_analyze.py --data data/nsidc_ggd318 --out data/nsidc_ggd318/out --no-plot
  python -I pipeline/ice_content.py data/nsidc_ggd318/out/grid_0p1deg.csv.gz data/interim/ice_content.npz
fi

for layer in 0-1m 1-5m gt5m; do
  python -I pipeline/score.py data/interim "$layer"
  python -I pipeline/validate.py data/interim "$layer"
  python pipeline/experiment_window.py data/interim "$layer"            # Earth Engine, ~5-10 min per layer
done

python -I pipeline/fetch_places.py data/raw/naturalearth
python -I pipeline/places.py data/raw/naturalearth data/interim
python pipeline/polygon_check.py data/interim out                        # experimental, validated=false
python -I pipeline/export.py data/interim out
