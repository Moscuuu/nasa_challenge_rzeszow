# Mars Analog Finder

NASA Space Apps Challenge 2026, "terrestrial analogs". We look for **places on Earth to test drilling into ground ice like the ice at seven candidate Mars base sites**: Arcadia Planitia, Deuteronilus Mensae, Phlegra Montes, Erebus Montes, Amazonis Planitia (Posiolova crater), Utopia Planitia and the Hellas rim.

## How it works

At every candidate site the ice lies under a dry cover, never thaws, and the ground is colder than anywhere on Earth. So Mars sets the conditions; Earth is not ranked by "closeness" to values it cannot reach.

1. **Mask.** Every 0.1° cell of permafrost on Earth (Global Permafrost Zonation Index; ESA Permafrost CCI in Antarctica): 401 614 cells.
2. **Filters.** Ground at or below −5 °C, summer thaw no deeper than 0.5 m, bare ground present, not a glacier. About 53 000 cells pass.
3. **Score.** Four features: summer surface temperature against the Mars site (in kelvin), depth to never-thawing ground, dryness, bare ground in summer.
4. **Region types.** Cells are ranked separately in three groups (northern, Antarctic, outside CCI coverage), each on the features that are valid there.
5. **Stability.** The score is recomputed under 20 variants of thresholds and features; a cell's stability is how often it stays in the top 10 %.
6. **Areas.** Top cells are grouped into areas of at most 5 × 5 cells; the best cell is the suggested drilling point.

## What it finds (1–5 m layer)

| region type | leading areas |
|---|---|
| northern | **Peary Land, north Greenland** (~82°N): ground −17 °C, thaw 0–0.1 m, summer maximum −6 °C, ~130 mm precipitation, stable in nearly all variants. Then Ellesmere Island. |
| Antarctic | McMurdo Sound area, Terra Nova Bay, Queen Maud Mountains |
| outside CCI | **High Andes, Puna de Atacama** (27–29°S, around Ojos del Salado); low confidence, see limits |

## Where it breaks

- Method check: 4 of 9 known analogs land in the top 10 % of their region type; all 6 wet or warm contrasts are rejected. Haughton Crater and Eureka sit mid-table (61–65): their surface warms to about +15 °C in summer, some 25 K above the Mars sites.
- Earth data cannot tell dry-frozen ground from ice-cemented ground. Ice amount is not scored.
- The Mars sites differ only in summer surface temperature, and six of the seven are within 6 K of each other, so ties between sites are normal.
- Ground temperature and thaw depth are model products (ESA CCI), for 2023 only. Outside CCI coverage the ground temperature is air temperature plus an assumed 2 K.
- Earth cannot reproduce Mars pressure, gravity, radiation or its 200 K ground.

Full method, numbers and limits: [`docs/superpowers/specs/2026-11-15-drilling-analog-design.md`](docs/superpowers/specs/2026-11-15-drilling-analog-design.md) (Polish).

## Repository

| path | what |
|---|---|
| `pipeline/` | the analysis; thresholds in `pipeline/config.py` |
| `out/` | results handed to the app (GeoJSON, PNG maps, validation) |
| `app/` | 3D viewer (React, three.js) |
| `docs/` | spec, decision log (`docs/DECISIONS.md`), data contract with the app |
| `analysis/` | per-dataset studies (history) |
| `GLOSSARY.md` | project vocabulary |

## Run

```bash
pip install -r requirements.txt
bash pipeline/run_all.sh        # needs an Earth Engine service-account key, see scripts/ee_init.py; ~7 GB of downloads
cd app && npm install && npm run dev
```

The app has not yet been updated to data contract 0.9; the changes it needs are listed at the top of `docs/contracts/analysis-to-gui/CONTRACT.md`.

## Data

Global Permafrost Zonation Index (Gruber 2012) · ESA Permafrost CCI v5 · ERA5-Land · NASA SMAP L4 · NASA MODIS MOD10A1 and MCD12Q1 · SWIM (Subsurface Water Ice Mapping, Mars) · Natural Earth. Links in `out/manifest.json`.
