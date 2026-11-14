# Algorithm improvement brief (for an agent, e.g. Claude Fable)

Purpose: hand an agent everything needed to **improve the Earth↔Mars analog scoring algorithm** in `pipeline/` without repeating the analysis. Findings come from an ML/feature audit done on 2026-11-14/15. The prototypes are local scripts **not in the repo** (repo rule: markdown only from that work), so every method below is specified precisely enough to re-implement. Polish human summary: `analysis/ml_model/ML_ANALIZA_podsumowanie.md`.

Read first: `GLOSSARY.md`, `docs/superpowers/specs/2026-11-14-permafrost-analog-analysis-design.md` (current spec, sections 5a–5g), `docs/contracts/analysis-to-gui/CONTRACT.md`, `context/permafrost_cci_for_agents.md`, `context/swim_for_agents.md`.

## 1. Goal (as stated by the team)

Find places on Earth where **drilling into frozen ground is analogous to Mars**: studying ground ice and water under approximately Mars-like conditions near the 7 Mars Base Candidate Sites (mid-latitude ice under a dry cover, centimetres to ~1 m deep, never thawing). The current pipeline compares *all* conditions. For drilling, **what matters is the subsurface**: cold ground at depth, a shallow ice table, a dry cover, no summer thaw, and the amount of ice.

## 2. Current algorithm (pipeline/score.py, 8th run on main)

- Unit: 0.1° Earth Cell. Mask: CCI 2023 mean PFR ≥ 10 % → 371 225 cells (N hemisphere 25–85°N plus Antarctica).
- Per Depth Layer, per Mars site, feature scores:
  - **Temperature:** rank of |Earth − Mars| over 6 ERA5-Land quantities in 0–1 m (daily min, max and amplitude, whole year and local summer); one quantity in deeper layers.
  - **Ice:** `1 − |pct_Earth − pct_Mars|`, using CCI-derived ice certainty vs SWIM C.
  - **Polygons:** `1 − |pct_Earth − pct_Mars|`, using GST-derived crack potential vs SWIM polygon share.
  - **Dryness** (0–1 m only): SMAP summer wetness plus ERA5 precipitation, driest = best.
- Overall score = equal-weight mean. **Missing data scores 0** (team rule since 5f). Best site = max over the 7 sites.
- Validation (`pipeline/validate.py`): median percentile of three boxes. McMurdo Dry Valleys ≥ 90, Haughton/Devon ≥ 90, Alaska North Slope < 50.
- Last results (0–1 m / 1–5 m): Dry Valleys 97.2 / 91.6, Devon 84.5 / 92.0, Alaska 59.0 / 67.6. **Two failures in 0–1 m.** The 0–1 m top 2000 cells are Greenland (954), Canadian Arctic (876) and Antarctica (86). The 1–5 m top 2000 are almost all Canadian Arctic (1993).

## 3. Verified problems (with evidence)

| # | problem | evidence | consequence |
|---|---|---|---|
| P1 | Redundant features | Spearman: GST~T1–5 m~T10 m ≥ 0.96; crack potential~GST −0.93; ice > 5 m ≡ PFR (1.00); shallow ice~ALT −0.96. PCA on 8 CCI features: PC1 81 %, 3 PCs 98 %. | "Cold" is counted 3–4 times |
| P2 | Ties / saturation | Share of cells at the single modal value: ice 1–5 m 42 %, ice > 5 m 44 %, crack 50 %. Below GST −20 °C (13 k cells, all Antarctica) every feature is at its limit. | Ranks carry no information |
| P3 | Mars outside Earth's range | Deep ground: Mars 200–203 K vs Earth minimum 234 K. Daily amplitude: Mars 69–79 K vs Earth ≤ ~39 K. The Mars sites differ by only 1.6–2.9 K at depth. | "Closest to Mars" collapses to "coldest on Earth". Deeper layers cannot tell sites apart. |
| P4 | Percentile matching of ice 1–5 m inverts the intent | Arcadia and Amazonis have a SWIM 1–5 m percentile ≈ 0.27, so cells with full permafrost (value 1, mid-rank 0.79) score 0.47 and partial permafrost (≈ 0.55) scores best | Weaker permafrost is rewarded for 2 of 7 sites |
| P5 | The validation test mainly checks coldness | A logistic regression trained on one known analog vs Alaska, with **no Mars information**, places the other known analog at the 98th (Dry Valleys) and 91st (Devon) percentile | Passing the test is weak evidence; any cold-favouring score passes |
| P6 | Missing features decide winners | Under the old "skip missing" rule, 63 % of the 0–1 m top 2000 went to sites without polygon data. In the 1 km prototype, "skip" puts 100 % of the top in Antarctica and "missing = 0" puts 94 % in the Canadian Arctic (**zero overlap**). | The rule for missing data is a first-order modelling decision |
| P7 | Daily amplitude is irrelevant for drilling | The diurnal wave decays e-fold every ~15–20 cm, so < 1 % is left at 1 m. Only cold high deserts (Tibet, Aksai Chin: ~27–35 K) approach Mars, and their surface reaches about +7 °C daily max and their active layer thaws 0.2–0.5 m. | Any score pulled toward the Mars amplitude picks Tibet |
| P8 | ERA5 temperature is wrong in mountains | 0.1° orography is smoothed. The Ojos del Salado cell has mean skin T +3.9 °C, while DEM-based air MAAT at the summit pixel is −13.9 °C. On Andean permafrost pixels, ERA5 (even shifted by the within-cell MAAT anomaly) passes a −5 °C filter on 0–11 % of pixels, against 90 % with MAAT. Dry, sunny surfaces reach about +25 °C daily max. | Do not filter or score mountains on ERA5 skin temperature |
| P9 | The mask includes cells without shallow perennial ice | 76 235 of 371 225 mask cells (20 %) contain **no** 1 km CCI pixel with PFR ≥ 50 % and ALT ≤ 1 m | Noise in the 0–1 m ranking |
| P10 | Coverage gap | CCI has no South America and nothing below 25°N. The dry Andean permafrost (Puna de Atacama, a classic Mars analog) is missing entirely. | Real analogs are never scored |
| P11 | CCI artefacts in Antarctica | ALT = 0 m almost everywhere (underestimated). The mask area is far larger than the ice-free ground (183 k vs 22–45 k km²). CCI cannot separate **dry permafrost** (frozen, no ice) from ice-cemented ground. | Antarctica looks perfect on ice features for the wrong reason |

## 4. Decisions already taken by the team (do not re-litigate)

- **Salt / salinity is out of scope.** Earth conditions are not comparable.
- **Temperature is used as a filter, not matched by percentile.** "Mid-cold on Mars (−40 °C)" ≠ "mid-cold on Earth (−10 °C)".
- **Daily amplitude is removed from the score.**
- **Antarctica must stay in the results.**
- PCA is a **diagnostic** (is a new feature new information?), **not** the scoring metric. Whitening gives every independent axis full weight, including noise axes such as the few low-PFR outliers that formed PC2 among cold cells.
- The team prefers an actual **ML model** where it is justified.
- Grid: the team accepts a **1 km grid**, copying 0.1° values (precipitation, SMAP, model outputs) into 1 km pixels.

## 5. Prototypes and their results (to re-implement in `pipeline/`)

### 5.1 Ground-ice amount model (supervised, justified: many real labels)

- **Target:** NSIDC GGD318 ice content class (1 low, 2 medium, 3 high; upper 10–20 m), excluding glaciers. GGD318 is already on a 0.1° grid at `data/nsidc_ggd318/out/grid_0p1deg.csv.gz` in the data snapshot (commit `c653840`, `git show c653840:data/...`). No Earthdata login is needed.
- **Features (per 0.1° cell):**
  - CCI GST and T10m, log10 ALT (clip ≥ 0.01 m), PFR;
  - ERA5-Land tmin, tmax, amp;
  - log10 precipitation;
  - NDVI max (NaN in Antarctica → 0; negatives → 0).
- **Model:** `HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, max_leaf_nodes=31, class_weight="balanced")`.
- **Validation:** 5-fold `GroupKFold` with groups = 5°×5° blocks; 305 936 labelled cells.

| model | balanced acc. | AUC high-vs-rest |
|---|---|---|
| gradient boosting | **0.679** | **0.848** |
| logistic regression | 0.563 | 0.671 |
| chance | 0.333 | 0.5 |

- Per-class recall 0.64–0.73. Devon out-of-fold P(high) = 0.91, against 90 % "high" in GGD318. Permutation importance: precipitation > T10m > tmax > amplitude > tmin > NDVI > GST > ALT > PFR.
- **Antarctica: 93.9 % of cells have a feature outside the training [p0.5, p99.5] range.** Treat predictions there as missing and flag `extrapolation`.
- Output to use: expected class `ice_exp = Σ p_k·k`, using out-of-fold values where labels exist.

### 5.2 Drilling score, 0.1° version

- **Filters:** T10m ≤ −5 °C and ALT ≤ 0.5 m (72 066 cells pass).
- **Score:** equal-weight mean of percentiles among eligible cells:
  - colder T10m,
  - smaller ALT,
  - higher `ice_exp`,
  - lower precipitation.
- Ineligible cells rank at the bottom.
- **Validation:** Dry Valleys 99.3, Devon 93.9, Alaska 0.0 (85 % of Alaska cells fail the filters). **All pass.**
- **Top 2000:** Antarctica 1783, northern Greenland 189, Ellesmere 28. Zero overlap with the pipeline's 1–5 m top 2000.

### 5.3 PCA (diagnostic)

| feature set | variance per PC |
|---|---|
| 9 features (GST, tmin, tmax, amp, log ALT, PFR, shallow ice, log precip, NDVI), all cells | PC1 65 %, PC2 13 %, PC3 8 %, PC4 6 % |
| same 9 features, cold cells (GST ≤ −5 °C) | 61 / 11 / 10 / 8 % |

- Dryness and amplitude add real axes compared with the CCI-only set (81 % / 13 % / 4 %).
- PC1 = cold + dry + bare + shallow ice. These go together in nature, so precipitation and NDVI also carry "cold".
- A separate "high cold desert" axis exists: amplitude + tmax, no vegetation.
- **A Mahalanobis distance to a Mars-like corner was tried and rejected.** It passed validation (99 / 91 / 0), but the top 2000 were almost all Aksai Chin/Tibet (amplitude dominates after whitening; daily max +7 °C). Only 12 cells overlap with the pipeline.

### 5.4 Coverage: Global Permafrost Zonation Index (Gruber 2012)

- **Source:** public, no login, `https://microsite.geo.uzh.ch/cryodata/pf_global/`. Files `PZI.flt` and `MAAT_MEAN.flt` (3.1 GB each, float32 LSB, 43200×18000, 30″, 90°N–60°S, NODATA −9999). PZI ranges 0.1–1, with 0.01 = uncertainty fringe. MAAT_MEAN is air temperature downscaled with SRTM30.
- **Agreement with the CCI mask** (N hemisphere): 88 % of CCI mask cells have ≥ 5 km² of PZI ≥ 0.5.
- **New relative to the CCI mask:**

  | where | cells | cold & dry | verdict |
  |---|---|---|---|
  | **Andes 22–35°S** | **463** (12 k km² permafrost) | 127 | ✅ add |
  | Greenland ice sheet / glaciers | ~44 k | ~23 k | ❌ ice, not ground |
  | Siberian/Mongolian taiga | ~27 k | 20 | ❌ PZI ignores snow insulation |

  "Cold & dry" = MAAT ≤ −5 °C and precipitation < 300 mm.
- **Key Andean sites:**

  | site | permafrost in 0.5° window | coldest pixel MAAT | precipitation |
  |---|---|---|---|
  | Ojos del Salado (−27.11, −68.54) | 917 km² | −13.9 °C | 275 mm |
  | Llullaillaco (−24.72, −68.54) | 52 km² | −12.7 °C | 178 mm |

- CCI at native 1 km adds almost nothing in mountains: only 11 cells outside the mask have ≥ 5 km² of shallow-ice pixels.

### 5.5 1 km drilling score (latest prototype)

- **Mask:**
  - CCI native pixel (0.01°) with PFR ≥ 50 %;
  - outside CCI coverage (25°N–60°S), PZI pixel ≥ 0.5.

  Total 25.3 M pixels; the run takes ~50 s and ~6 GB RAM.
- **Ground temperature:**
  - CCI T10m;
  - in the PZI zone, MAAT + 2 °C (assumed air→ground offset; to be checked).
- **Filters:** T ≤ −5 °C; ALT ≤ 0.5 m where ALT is known (ALT is unknown in the PZI zone, so that filter does not apply there). 6.30 M pixels pass, 6 609 of them in the PZI zone.
- **Features:**
  - cold (T),
  - shallow ice (ALT),
  - `ice_exp` (0.1° model output copied to pixels, NaN where extrapolated),
  - dry (0.1° precipitation copied).

  Percentiles are taken among eligible pixels.

| variant | Dry Valleys | Devon | Alaska | top 20 000 px |
|---|---|---|---|---|
| missing skipped | 99.5 | 94.1 | 0.0 | 100 % Antarctica (Transantarctic Mts 83–85°S, T ≈ −35 °C) |
| missing = 0 (team rule) | 98.6 | 96.0 | 0.0 | 94 % Canadian Arctic (Ellesmere/Axel Heiberg 78–81°N, T ≈ −16 °C, ALT 0.1 m), 6 % Greenland |

- **Andes in the 1 km score:** 6 411 eligible pixels, none in the top 20 000.
  - Best percentile: Llullaillaco 94.2 (skip) / 82.7 (penalty).
  - Ojos del Salado: 457 px, best 92.0 / 81.4.
  - They are "warm" permafrost (−8 to −12 °C) with only 2 of 4 features, and ERA5 precipitation is likely overestimated there.

## 5.6 Scope of autonomy (what the agent decides vs what stays with the team)

| | items |
|---|---|
| **Fixed: implement as specified** | ground-ice amount model (5.1) as a feature, with an `extrapolation` flag; temperature and ALT as **filters**; no daily amplitude, salt, or "analog / not analog" classifier; Antarctica stays in the results; PCA only as a diagnostic |
| **Agent may propose and build** | additional ML models **where real labels are plentiful**. Example: impute the SWIM polygon share for Mars sites without survey coverage, trained on millions of surveyed SWIM pixels (C_i at 3 depths, neutron, thermal, latitude, modelled temperature). Also other feature-engineering or downscaling methods (e.g. DEM lapse-rate correction). Each must ship with: spatial block cross-validation; a comparison against a simple baseline (logistic regression or a rule); and the 3-box validation before vs after. If a model does not beat its baseline, drop it and say so. |
| **Prepare, do not decide** (team decision) | the missing-data rule (§3 P6: it flips the top list between continents); filter thresholds (−5 vs −10 °C, ALT 0.5 vs 1 m); separate per-analog-type lists; the MAAT→ground offset in the PZI zone. For each, deliver a short comparison (validation results, top-list regions, overlap) and a recommendation. |

## 6. Recommended work (ordered; each item has acceptance criteria)

1. **Restructure the score around drilling (layer 1–5 m primary; 0–1 m describes the dry cover).**
   - Replace temperature percentile-matching with **filters**: ground T at 5–10 m ≤ −5 °C (tunable −10 °C) and ALT ≤ 0.5 m. Drop amplitude, crack potential (a GST duplicate) and ice > 5 m (a PFR duplicate) from the score. Use ice 1–5 m as a filter or a monotone score, never as a percentile match (P4).
   - *Accept when:* the three validation checks pass in the drilling layer; a Spearman matrix of the remaining features shows no pair with |ρ| > 0.9.
2. **Integrate the ice-amount model (5.1) as a feature.**
   - Add `ice_exp`, `p_high` and `extrapolation` per cell. In Antarctica, ice amount = **no data**: never the model's guess, and never a silent 0. Re-run the spatial CV inside the pipeline and log the metrics to `out/manifest.json`.
   - *Accept when:* CV balanced accuracy ≥ 0.65; the extrapolation flag is in the GUI contract (bump `contract_version`).
3. **Decide and document the missing-data rule explicitly.** P6 shows it flips the top between continents. Options:
   - (a) score only on features available in every region;
   - (b) per-region-type rankings;
   - (c) impute with stated uncertainty.

   Present both current variants to the team before choosing.
   - *Accept when:* the rule is written in the spec, and top-list sensitivity to the rule is reported.
4. **Per-analog-type rankings in the output.** One global ranking is always won by the coldest place. Emit separate top lists:
   - **polar** (Antarctica, Arctic),
   - **high-mountain** (Andes, Tibet/Pamir/Karakorum, defined e.g. by elevation or PZI zone).
   - *Accept when:* the Andes (Puna de Atacama) and Tibet appear in the high-mountain list, with a short "where the analogy breaks" note per type (P7).
5. **Grid upgrade to 1 km with sub-cell features (5.4–5.5).**
   - Mask = CCI pixel PFR ≥ 50 % ∪ PZI ≥ 0.5 outside CCI, excluding glaciers and ice sheets.
   - Ground T from CCI or, in the PZI zone, MAAT (+ offset).
   - **Never** ERA5 skin temperature for mountain pixels (P8).
   - For the GUI, aggregate top pixels into **areas** (connected components or 0.5° groups) with the best pixel as the suggested drilling point.
   - *Accept when:* the Andes are in the ranking; the GUI files stay within size limits; the 0.1° and 1 km validations agree within a few percentile points.
6. **Tighten the 0–1 m mask (P9).** Require ≥ 1 km² of shallow perennial ice pixels (PFR ≥ 50 % and ALT ≤ 1 m) per 0.1° cell, which removes ~76 k cells.
7. **Strengthen validation (P5).**
   - Add known drilling analogs: University Valley and Beacon Valley (Antarctica), Axel Heiberg, Svalbard.
   - Add point data: GTN-P boreholes (ground T profiles) and CALM (active layer), including a check of CCI ALT = 0 in Antarctica (P11).
   - Report validation per analog type, not only globally.
8. **Better ice data where possible.**
   - Canada ground-ice map (O'Neill et al. 2019);
   - Yedoma database (IRYP, Strauss et al., PANGAEA);
   - Dry Valleys permafrost-type map (dry-frozen vs ice-cemented, depth to ice; Bockheim et al. 2007), to be digitised.

   Verify access and licences before use; citations here are from memory.

## 7. Pitfalls (do not repeat)

- Do not compare raw temperatures across planets, and do not percentile-match temperature (P3).
- Do not let a whitened or Mahalanobis metric run on features with unreachable Mars targets: the axis with the largest unreachable gap dominates (5.3).
- Do not treat GGD318 or model ice as known in Antarctica (93.9 % out of the training domain).
- Do not read CCI ALT = 0 in Antarctica as "ice at the surface" (P11). Do not read "permafrost" as "ice present" (dry permafrost).
- Do not add PZI cells on ice sheets, glaciers or snowy taiga (§5.4 table).
- Do not use the 3-box validation as proof of Mars-likeness (P5).
- Data rule from the team: only markdown goes into the repo from analysis work; `data/` is git-ignored. Code changes belong in `pipeline/`, on a branch, via PR.

## 8. Data locations

| data | where |
|---|---|
| CCI 2023 PFR / ALT / GTD (NH AREA4, Antarctica AREA27) | `pipeline/fetch_cci.py` (CEDA, public) |
| ERA5-Land skin tmin / tmax / amp (2023, 0.1°), precipitation, NDVI, GGD318 0.1° grid | data snapshot: `git show c653840:data/interim/era5_skin_2023.npz`, `data/dryness/raw_precip_mm_yr.npy`, `data/dryness/raw_ndvi_max.npy`, `data/nsidc_ggd318/out/grid_0p1deg.csv.gz` (row 0 = 90°N, col 0 = −180°, 0.1°) |
| SMAP L4 summer wetness | `pipeline/fetch_smap.py` (Earth Engine) |
| PZI / MAAT 1 km | `https://microsite.geo.uzh.ch/cryodata/pf_global/` (`PZI.flt`, `MAAT_MEAN.flt`, `.hdr`, `README.txt`) |
| Mars sites, SWIM | `pipeline/mars_sites.py`, `pipeline/fetch_swim.py`, `out/mars_sites.geojson` |

Citations: Gruber S. 2012, *The Cryosphere* 6, 221–233, doi:10.5194/tc-6-221-2012 (PZI). Brown et al. 2002, NSIDC GGD318, doi:10.7265/skbg-kf16. ESA Permafrost_cci v5 (Obu et al.).
