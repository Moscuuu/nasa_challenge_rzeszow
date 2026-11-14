# Mars Analog Finder: Data Pipeline Design

> **SUPERSEDED (2026-11-14).** The project moved to a permafrost focus: 7 Mars Base Candidate Sites (Phoenix is not used) and an open list of Earth Regions. See `GLOSSARY.md`. This document is kept for history only. A new spec follows.

Date: 2026-11-14
Context: NASA Space Apps hackathon challenge "find new terrestrial analogs" (see `docs/Introduction_to_challenge.md`, `docs/Resources.md`). Time budget: **24 hours total**, Python team with ML experience.

## 1. Intent and why

The headline of the submission is **the method**: a systematic, data-driven way to search the whole Earth for places similar to Mars. The method has to be trustworthy, so it is **validated first against well-known Mars analogs**: it must rediscover them before we believe what else it finds. Then it surfaces **every Earth area above a similarity threshold**, ranked, and each one is matched to its closest specific Mars site ("Mars twin"). Lesser-known high-scoring areas are the "discoveries" for the pitch.

The challenge explicitly rewards explaining *what is similar, how similar, and where the analogy breaks down*, so every area carries a per-parameter breakdown rather than one opaque number.

This document covers the **data stage only**. A web app (ranking / "browse" page where you hop from area to area) comes later and consumes this stage's GeoJSON output.

## 2. Goals

1. A global Earth land grid with a set of parameters that are **measurable on both Earth and Mars**.
2. A table of specific Mars reference sites with the same parameters.
3. A similarity score per Earth cell per Mars site, with **learned parameter weights**. The weights answer "which parameters are most valuable for spotting similarity".
4. Validation: leave-one-out test showing known analogs rank highly; numbers and a chart we can put on a slide.
5. A threshold derived from the known analogs (not picked arbitrarily).
6. High-scoring neighbouring cells merged into **named areas**, each with score, rank, Mars twin and per-parameter breakdown.
7. GeoJSON files ready for a web app.

## 3. Non-goals

- The Moon. **Mars only** (decided: richer Mars data).
- A fixed "top 3". The output is a full thresholded ranking. Picking showcase areas for the pitch is done by humans afterwards.
- The web app itself, a database or a backend. Output is plain files.
- High-resolution (<1 km) analysis or downloading raw scenes globally.
- Simulating what Earth cannot reproduce (gravity, pressure, radiation). These are stated as fixed limitations, not modelled.

## 4. Anti-goals (it fails even if it runs)

- The method only finds "deserts". If the ranking is just "dry and hot", it hasn't learned anything. Per-parameter breakdowns and the Mars-twin matching must show *why* an area is analogous.
- Known analogs are rediscovered only because they were used for tuning. The validation must use held-out analogs.
- Similarity scores with no explanation, or that hide where the analogy breaks down.
- Spending the 24 hours on data plumbing with no end-to-end result. A coarse full pipeline beats a fine half-pipeline.

## 5. Constraints

- 24 hours, including the app later. The data stage should aim for an end-to-end coarse run within roughly the first 8–10 hours.
- Python.
- Accounts: **Google Earth Engine** (registered) for Earth-side global computation. **NASA Earthdata Login** (free, register at urs.earthdata.nasa.gov) for anything not in Earth Engine (for example EMIT minerals). Mars data needs no account (PDS, USGS Astrogeology, Mars Climate Database).
- Use open NASA / space-agency data and cite each source (judging expectation).

## 6. Decisions made with the team

| Decision | Choice |
|---|---|
| Target body | Mars only |
| What the pitch leads with | The method, backed by discovered areas |
| Proof of trustworthiness | Validate against known Earth analogs first (held-out) |
| Output scope | Everything above a threshold, ranked, not a fixed top 3 |
| Threshold | Determined from data (see §8.4) |
| Unit of a "place" | Neighbouring high-scoring cells grouped into named areas |
| Mars reference | Many specific Mars sites, each Earth area gets its closest "Mars twin" |
| Earth processing | Google Earth Engine |
| Hand-off to app | Plain GeoJSON files |

## 7. Data

### 7.1 Parameters (shared Earth–Mars feature space)

A parameter is usable only if it means the same thing on both planets. Two kinds:

**A. Matchable parameters.** Earth and Mars values overlap, so we compare an Earth cell directly against a specific Mars site.

| Parameter | Earth source (GEE unless noted) | Mars source |
|---|---|---|
| Slope (median, p90) | Copernicus GLO-30 / SRTM DEM, aggregated | MOLA MEGDR (463 m) |
| Surface roughness (elevation std / TRI within cell) | same DEM | MOLA (or HRSC/CTX DEM where available) |
| Albedo | MODIS MCD43A3 | TES albedo map |
| Thermal inertia proxy: apparent thermal inertia ATI = (1 − albedo) / (day − night LST) | MODIS MOD11A2 + MCD43A3 | THEMIS/TES thermal inertia maps (compared by percentile, see note below) |
| Mineral class presence: iron oxides, phyllosilicates (clays), sulfates, carbonates, chlorides/salts, olivine/basaltic | ASTER band-ratio indices (global, GEE) and EMIT L2B minerals (Earthdata, arid belt ±52°) | CRISM / OMEGA mineral maps and literature, encoded per site as presence/strength |

*Units (call made in design):* slope and roughness are compared in physical units, but the Earth DEM is first resampled to ~460 m to match MOLA so the numbers mean the same thing. Albedo is physical on both planets. Thermal inertia is **not** comparable in units (Earth ATI is a unitless proxy), so it is compared by **percentile within each planet's own distribution**. We say so in the pitch: "how similar" for thermal inertia means "similar relative position", not equal value.

**B. Extremity parameters.** Earth never reaches Mars values, so we score how far toward Mars an Earth cell lies within Earth's own range (percentile-style). These are mostly the same for every Mars site, except where a site's latitude or climate differs (for example polar sites).

| Parameter | Earth source | Mars direction |
|---|---|---|
| Aridity: annual precipitation | CHIRPS / ERA5 | lower = more Mars-like |
| Vegetation: NDVI annual max | MODIS MOD13 | lower = more Mars-like |
| Mean surface temperature, cold-side | MODIS LST | colder = more Mars-like |
| Diurnal temperature range | MODIS LST day − night | larger = more Mars-like |
| Dust / aerosol load (AOD) | MODIS MAIDA C or MERRA-2 | dust-storm-prone = more Mars-like |
| UV exposure (optional) | TEMIS / OMI UV index | higher = more Mars-like |
| Ice / permafrost (relevant for polar or mid-latitude-ice Mars sites) | permafrost / snow-cover products | presence matches ice-bearing sites |

Expected weak spot: mineralogy, because EMIT coverage is partial and ASTER band ratios are noisy. Cells with missing mineral data must still be scorable (see §8.2).

### 7.2 Earth grid

- Global land, ~0.05° (~5 km) cells. Start at 0.1° for the first end-to-end run, then refine if time allows.
- Aggregate each parameter per cell in GEE, export as a table (Parquet/CSV) to Google Drive or Cloud Storage, then work locally in pandas/geopandas.
- Antarctica included (Dry Valleys is a key known analog). Check product coverage there.

### 7.3 Mars sites (reference list)

- Starting list: NASA's **candidate human landing exploration zones** (from the First Landing Site/Exploration Zone workshop, roughly 40–50 sites), plus rover/lander sites: Jezero, Gale, Meridiani, Gusev, Utopia (Zhurong), Elysium (InSight), Phoenix (polar), and key science targets (for example Mawrth Vallis, Nili Fossae, polar layered deposits).
- Each site is a row with coordinates and the same parameters, sampled from Mars global maps over a site-sized window, with mineralogy hand-encoded from CRISM/OMEGA products and literature where maps are impractical.
- Stored as `mars_sites.csv` (source of truth, hand-editable) and exported as GeoJSON.

### 7.4 Known Earth analogs (validation labels)

A list of ~15–25 well-established analogs, each as a point or small polygon with a citation, for example: Atacama (Yungay), Haughton Crater/Devon Island, Rio Tinto, McMurdo Dry Valleys, Mojave/Death Valley, Hanksville Utah (MDRS), Icelandic highlands, Mauna Kea, Svalbard (Bockfjord), Pilbara, Dallol, Qaidam Basin, Lonar Crater, Kamchatka/Tolbachik, Namib. Where the literature says which Mars site or terrain they are analogous to, record it: it lets us also check Mars-twin matching.

*Call made in design:* each analog is tagged by type:
- **environmental/terrain**: the whole landscape is the analog (Atacama, Dry Valleys, Devon Island, Hanksville, Mojave, Qaidam, Namib, Pilbara, Dallol).
- **process/mineral/local**: a narrow feature or process is the analog (Rio Tinto, Lonar, Bockfjord, Tolbachik, Icelandic highlands, Mauna Kea), often wet, vegetated or smaller than a cell.

Only environmental/terrain analogs are used to learn weights and set the threshold. Process/local analogs are reported separately in validation as a check, so they can't drag the threshold down.

## 8. Method

### 8.1 Per-parameter similarity

For each Earth cell *e* and Mars site *m*, each parameter *k* gives a similarity *s_k(e, m)* in [0, 1]:
- Matchable: a kernel on the normalized difference, e.g. `exp(-(x_e - x_m)^2 / (2σ_k^2))`, with σ from Earth's spread of that parameter.
- Extremity: Earth percentile toward the Mars direction (1 = Earth's most Mars-like).
- Mineral classes: overlap between the cell's and the site's mineral presence vectors.

### 8.2 Combined score and learned weights

- Score `S(e, m) = Σ_k w_k s_k(e, m) / Σ_k w_k` over the parameters available for that cell (missing data renormalizes rather than penalizes).
- Area-level analog score `S(e) = max_m S(e, m)`. The argmax is the cell's **Mars twin**.
- **Weights are learned** so that known analogs rank as high as possible against the rest of Earth. Keep weights non-negative and the parameter count small (~10–15) to avoid overfitting a small label set. The learned weights are the deliverable answer to "most valuable parameters" and go on a slide.

### 8.3 Validation (do this before trusting any new result)

- **Leave-one-analog-out:** learn weights without analog *i*, then report analog *i*'s percentile rank among all Earth land cells. Repeat for every analog.
- Report: median held-out percentile, how many held-out analogs land in the top 1% / 5%, and a baseline comparison (equal weights, and "aridity only") to show the method beats "it's just a desert".
- Where the literature names a Mars counterpart, report how often the Mars twin matches it.
- **Timing (call made in design):** run validation early, on the first coarse (0.1°) end-to-end grid, around hour 6. Do not wait for the refined grid.
- **If validation fails** (held-out analogs not clearly above baselines): spend at most ~2 hours adjusting parameters, kernels or the label set. Then ship whatever is best and report the validation numbers honestly, including the weak ones. An honest "here's where the method struggles" still fits the challenge's "where the analogy breaks down" framing.

### 8.4 Threshold

Derived from validation: the score that most held-out known analogs clear (default: the score at which ~80% of held-out analogs pass). Meaning: "at least as Mars-like as places scientists already use". The value is recorded in the output.

### 8.5 Grouping into named areas

- Cells above threshold → connected components (8-neighbour) → polygons. Drop tiny components below a minimum size.
- **Split oversized areas (call made in design):** a component larger than a maximum size (default ~50,000 km², tunable) is split. Split first by Mars twin, then by local score peaks (watershed on the score surface), so that, for example, the Sahara becomes several distinct analogs rather than one. This follows the challenge's "consider scale" advice.
- If the result has more than ~500 areas, keep the top ~500 by score in `areas.geojson` and simplify polygon geometry, so the app stays fast.
- Area score = a robust aggregate of its cells (e.g. 90th percentile). Area Mars twin = most common or highest-scoring twin among its cells.
- Name each area from geographic gazetteers (e.g. Natural Earth / GeoNames features plus country). Flag areas that overlap known analogs as `known: true`. The rest are discoveries.

## 9. Outputs (contract with the web app)

All files in a single output folder, WGS84 GeoJSON.

- `areas.geojson`: one polygon feature per named area. Properties at minimum: `id`, `name`, `country`, `rank`, `score`, `known` (bool), `known_analog_name` (if any), `mars_twin_id`, `mars_twin_name`, `area_km2`, `centroid` [lon, lat], `params`: per-parameter `{value, mars_value, similarity, weight}` for the twin, `strengths` (top matching parameters), `breaks_down` (weakest parameters). The last two are short lists for the "what's similar / where it breaks" text.
- `mars_sites.geojson`: Mars sites as points in Mars planetocentric latitude and **east-positive longitude in −180..180°** (the same convention as Earth GeoJSON, so the app needs no conversion), with their parameter values and a `type` (human landing EZ, rover site, science target).
- `known_analogs.geojson`: validation labels with citations and their held-out rank.
- `validation.json`: learned weights, baseline comparisons, held-out ranks, threshold value, run settings (grid resolution, data versions).
- Optionally `cells.parquet` (intermediate, not for the app).

## 10. Limitations to state in the submission

Earth cannot reproduce Mars gravity, ~6 mbar CO2 atmosphere, surface radiation or the full temperature range. The extremity parameters measure "most Mars-like on Earth", not "equal to Mars". Mineral coverage is partial, and grid resolution (~5 km) hides small features such as individual caves or lava tubes.

## 11. Left to the builder

- Exact grid resolution after the first run, and export mechanics (Drive vs Cloud Storage, tiling).
- Exact GEE collections and date ranges, and the ASTER band-ratio formulas.
- Weight-learning algorithm (e.g. constrained optimization of a ranking loss, or positive-vs-background logistic regression with non-negative coefficients), as long as §8.3 validation is used.
- Kernel widths, minimum area size, area aggregation and naming heuristics.
- Repo layout for pipeline code and where outputs live.
- Final list of Mars sites and known analogs within the guidance above.
