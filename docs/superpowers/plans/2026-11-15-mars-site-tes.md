# Per-site Mars TES Thermal Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared albedo 0.25 / thermal inertia 250 of the 7 Mars sites with orbital (TES) values per site, check the thermal model against Phoenix and the Mars Climate Database, and re-run the pipeline.

**Architecture:** A new fetch script downloads the TES albedo map and the Putzig & Mellon 2007 thermal inertia map; `mars_sites.py` averages each over the site's 1° window and passes per-site values to `mars_thermal.run_sites` (which gets an adaptive time step so high inertia stays stable). A check script in `analysis/mars_tes/` compares the model with Phoenix MET and MCD. Score, validate, export re-run on local interim data.

**Tech Stack:** Python 3.11, numpy, requests (already in `requirements.txt`). PDS3 `.img` + `.lbl` read with numpy (no new dependency).

**Spec:** `docs/superpowers/specs/2026-11-15-mars-site-tes-design.md`

## Global Constraints

- Team rule (`DECISIONS.md`): **no pipeline unit tests.** Each task verifies with a command and an expected printed result.
- Do not change thresholds, `SUMMER_T_SCALE_K`, features, region types or anything in `app/`.
- Anti-goal: no tuning to make sites differ or to pass the method check.
- One thermal-inertia source for all 8 points (7 sites + Phoenix). The PDS TES TI map stops at 60°N and Phoenix is at 68.22°N, so TI comes from **Putzig & Mellon 2007** (night-time, annual map) for all points. Albedo: **TES global albedo 8 ppd** (Christensen et al. 2001), which is global.
- Same window as SWIM: `WINDOW_DEG = 1.0` around the site; mean of valid, non-interpolated pixels.
- Site coordinates are planetocentric latitude, **east-positive longitude −180..180** (see `SITES` in `pipeline/mars_sites.py`). Phoenix: 68.22°N, −125.7° (= 234.3°E).
- Raw files go to `data/raw/tes/` (git-ignored). Run scripts as `python -I ...`.
- The working tree holds unrelated uncommitted `app/` changes: **never stage `app/`**. Stage files by explicit path.
- Commits end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **Longitude convention flipped or offset** (PDS maps are often 0–360 and some are west-positive): values land on the wrong terrain silently. Pinned by the orientation check in Task 1 Step 3.
2. **Nodata / interpolated pixels averaged in** (fill values, ≤ 0, or interpolation-mask pixels): a site gets a nonsense inertia. Pinned by the range check in Task 1 Step 4.
3. **Thermal inertia above ~390 breaks the explicit scheme** (`assert kappa*dt/dz0² < 0.5` in `mars_thermal.py`): debris-apron sites may exceed it. Pinned by the high-TI run in Task 2 Step 2.
4. **Phoenix is outside SWIM coverage (60°N)**: it must go through the thermal model only, never `swim_window_mean`. Pinned by Task 3 Step 2 running Phoenix standalone.
5. **Model surface vs Phoenix air at 1 m compared 1:1**: wrong conclusion. Task 3 reports MET only as a lower bound for surface tmax unless TECP soil data is used.

---

### Task 1: Fetch and read TES albedo and thermal inertia

**Files:**
- Create: `pipeline/fetch_tes.py`
- Create: `pipeline/tes.py`
- Modify: `pipeline/run_all.sh` (add fetch line after `fetch_swim.py`)

**Interfaces:**
- Produces: `pipeline/tes.py`
  - `load_map(img: Path) -> tuple[np.ndarray, dict]`: reads a PDS3 image using its label (attached or detached `.lbl`): lines, samples, sample type/byte order, max/min latitude, westernmost/easternmost longitude, positive longitude direction. Returns float64 array (NaN for nodata) and a geo dict `{"lat_max", "lat_min", "lon_west_east", "ppd"}` normalised to **east-positive** longitude.
  - `window_mean(arr: np.ndarray, geo: dict, lat: float, lon: float, half_deg: float = 0.5, mask: np.ndarray | None = None) -> float`: mean of finite pixels in the box; `mask` (same shape, True = keep) drops interpolated pixels; raises `ValueError` if the box has no valid pixel or lies outside the map.
  - `site_surface(lat: float, lon: float, raw_dir: Path = Path("data/raw/tes")) -> dict`: `{"albedo": float, "thermal_inertia": float, "albedo_source": "tes_albedo_christensen2001", "ti_source": "tes_ti_putzig_mellon2007"}`.

- [ ] **Step 1: Write `pipeline/fetch_tes.py`** (usage: `python -I pipeline/fetch_tes.py data/raw/tes`). Follow the `fetch_swim.py` pattern (skip if present, `.part` then rename, same `HEADERS`). Files:
  - Albedo: `global_albedo_8ppd.img` + `.lbl` from the PDS Geosciences TES special products page (`https://pds-geosciences.wustl.edu/missions/mgs/tesspecial.html`; take the exact file URLs from that page).
  - TI: the Putzig & Mellon 2007 night-time annual map, its label/header and its interpolation mask from `https://se.psi.edu/inertia/2007` (or the same product on PDS: `https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html`). Confirm the map covers 68.22°N; if it does not, stop and report (spec fallback no longer applies).
  Run it. Expected: files in `data/raw/tes/`, albedo `.img` ≈ 16 MB.

- [ ] **Step 2: Implement `load_map`, `window_mean`, `site_surface` in `pipeline/tes.py`.** Read everything (dimensions, byte order, extent, longitude direction, scaling, nodata) from the label; do not hard-code. If the TI product is not PDS3, write a second small loader for its format with the same return shape.

- [ ] **Step 3: Orientation check.** Run:
  `python -I -c "import sys; sys.path.insert(0,'pipeline'); from tes import site_surface as s; print(s(8.4,69.5)); print(s(18.0,-133.0)); print(s(22.0,5.0))"`
  Expected: Syrtis Major (8.4N, 69.5E) albedo **< 0.15** (dark); Olympus Mons flank region (18N, −133E) thermal inertia **< 100**; Arabia Terra (22N, 5E) albedo **> 0.25** (bright). If any fails, the longitude handling is wrong: fix before continuing.

- [ ] **Step 4: Range check for the 8 points.** Print `site_surface` for each entry of `SITES` in `mars_sites.py` plus Phoenix (68.22, −125.7). Expected: every albedo in 0.08–0.40, every TI in 50–800, no exception. Note the values for the commit message.

- [ ] **Step 5: Add `python pipeline/fetch_tes.py data/raw/tes` to `run_all.sh` after the `fetch_swim.py` line. Commit.**

```bash
git add pipeline/fetch_tes.py pipeline/tes.py pipeline/run_all.sh
git commit -m "feat(pipeline): fetch and read TES albedo and Putzig-Mellon thermal inertia"
```

---

### Task 2: Per-site albedo and inertia in the Mars site model and export

**Files:**
- Modify: `pipeline/mars_thermal.py` (time step; extra return keys)
- Modify: `pipeline/mars_sites.py` (`ALBEDO, INERTIA` constants → per-site values; `main`)
- Modify: `pipeline/export.py` (`site_feature`, `SOURCES`)
- Modify: `docs/contracts/analysis-to-gui/CONTRACT.md` (one additive row, version stays 0.9)

**Interfaces:**
- Consumes: `tes.site_surface(lat, lon) -> dict` (Task 1).
- Produces:
  - `run_sites(lat_deg, albedo, inertia)` unchanged signature; return dict gains `"daily_max": np.ndarray (sites, sols)` and `"sol_ls": np.ndarray (sols,)` (Ls in degrees at local noon), used by Task 3.
  - `data/interim/mars_sites.json` per site: `albedo`, `thermal_inertia` (now per site), plus `albedo_source`, `ti_source`.
  - `out/mars_sites.geojson` properties gain `"surface": {"albedo", "thermal_inertia", "albedo_source", "ti_source"}`.

- [ ] **Step 1: Adaptive time step in `run_sites`.** Replace the fixed `STEPS_PER_SOL` inside the function with `steps = max(192, ceil(SOL * kappa.max() / (0.4 * dz[0]**2)))` rounded **up to a multiple of 24** (the hourly reshape and `STEPS_PER_SOL // 2` noon index need it); use `steps` everywhere `STEPS_PER_SOL` is used in the function. Keep the stability assert. Add `daily_max` (= `dmax`) and `sol_ls` to the return dict.

- [ ] **Step 2: Check the scheme at high inertia.** Run:
  `cd pipeline && python -I -c "import numpy as np; from mars_thermal import run_sites; o=run_sites(np.array([40.,40.]),np.array([.25,.25]),np.array([250.,700.])); print(o['summer_tmax'])"`
  Expected: no assertion error; TI 700 gives a **lower** summer tmax than TI 250 (higher inertia damps the daily maximum). Also run `python -I mars_thermal.py` and confirm its printout matches the version before the change (same 192-step path for TI 250).

- [ ] **Step 3: Use per-site values in `mars_sites.py`.** Remove the shared `ALBEDO, INERTIA` use in `main`; for each site call `site_surface(s["lat"], s["lon"])`, pass the arrays to `run_sites`, and write `albedo`, `thermal_inertia`, `albedo_source`, `ti_source` into each result. Update the module docstring line about "same first-order values".

- [ ] **Step 4: Export.** In `export.site_feature` add the `"surface"` block (Interfaces). Add two entries to `SOURCES`: `tes_albedo` (Christensen et al. 2001, TES albedo, PDS URL) and `tes_ti_putzig_mellon2007` (Putzig & Mellon 2007, Icarus 191:68–94, PSI/PDS URL). Add one row to the 0.9 change table in `CONTRACT.md`: `mars_sites.geojson` → `properties.surface` (albedo, thermal inertia, sources per site), additive, no GUI change needed.

- [ ] **Step 5: Run and compare.**
  `(cd pipeline && python -I mars_sites.py ../data/raw/swim ../data/interim/mars_sites.json)`
  Then print, per site, old `summer_tmax_K` from `git show HEAD:out/mars_sites.geojson` next to the new value from `data/interim/mars_sites.json`, with albedo and TI. Expected: runs without error; values differ from the old ones; all new summer_tmax in 230–300 K. Save this table; Task 3 and Task 4 use it.

- [ ] **Step 6: Commit.**

```bash
git add pipeline/mars_thermal.py pipeline/mars_sites.py pipeline/export.py docs/contracts/analysis-to-gui/CONTRACT.md
git commit -m "feat(pipeline): per-site TES albedo and thermal inertia in the Mars thermal model"
```

---

### Task 3: Phoenix and Mars Climate Database checks

**Files:**
- Create: `analysis/mars_tes/model_checks.py`
- Create: `analysis/mars_tes/mcd_summer_tmax.csv` (MCD values, one row per point)
- Create: `analysis/mars_tes/MARS_TES_podsumowanie.md` (short summary, Polish like other `analysis/*/` summaries)

**Interfaces:**
- Consumes: `tes.site_surface`, `run_sites` with `daily_max`, `sol_ls` (Tasks 1–2); `analysis/phoenix/phoenix_met_daily.csv` (columns `sol, ls, full_sol, t_max, ...`); `data/interim/mars_sites.json`.
- Produces: the comparison table (site, albedo, TI, model summer tmax, MCD summer tmax, Δ K) used in Task 4 docs.

- [ ] **Step 1: MCD values.** For the 7 sites + Phoenix, get mean daily maximum **surface** temperature in local summer from the MCD v6.1 web interface (`https://www-mars.lmd.jussieu.fr/mcd_python`): climatology dust scenario; local summer = Ls 90–180 (N) / 270–360 (S), sampled at Ls 105, 135, 165 (N) or 285, 315, 345 (S); daily max = max over local time; average the three. If the interface can be queried by URL, script it; otherwise ask the user to run the 8 queries and paste the values. Write `mcd_summer_tmax.csv` with columns `id,lat,lon,mcd_summer_tmax_K,scenario,ls_samples`. State the choices in the summary.

- [ ] **Step 2: Phoenix model run (thermal only).** In `model_checks.py`, run `run_sites` for Phoenix with its `site_surface` values; take the mean of `daily_max` over sols whose `sol_ls` is in **77–148** (mission window). Compare with the mean `t_max` of `full_sol == True` rows in `phoenix_met_daily.csv` (≈ 245.6 K, air at 1 m). Expected: model surface tmax **≥** MET air tmax; report the difference. Time-box TECP (soil probe, PDS Geosciences MECA) to 20 minutes: if a soil/surface temperature series is obtainable, compare 1:1 instead and say so.

- [ ] **Step 3: Model vs MCD table.** `model_checks.py` prints, for all 8 points: albedo, TI, model summer tmax (sites: from `mars_sites.json`; Phoenix: from Step 2 with the north summer window Ls 90–180), MCD value, Δ = model − MCD. Run it:
  `python -I analysis/mars_tes/model_checks.py`
  Expected: 8 rows, no NaN. No pass/fail threshold (the anti-goal forbids tuning); the |Δ| values are the result.

- [ ] **Step 4: Write `MARS_TES_podsumowanie.md`** (≤ 1 page): data and choices, the table, the Phoenix result, what it means for trusting `summer_tmax`. Commit.

```bash
git add analysis/mars_tes/
git commit -m "analysis: check Mars thermal model against Phoenix and MCD"
```

---

### Task 4: Re-run the pipeline and record the change

**Files:**
- Regenerated: `out/*` (via export)
- Modify: `docs/superpowers/specs/2026-11-15-drilling-analog-design.md` (§5, §11, §12)
- Modify: `docs/DECISIONS.md` (one row on top of 2026-11-15)
- Modify: `README.md` (only the limits bullet about Mars sites differing, if the spread changed)

**Interfaces:**
- Consumes: new `data/interim/mars_sites.json` (Task 2), table from Task 3.

- [ ] **Step 1: Re-run.**
  ```bash
  for layer in 0-1m 1-5m gt5m; do
    python -I pipeline/score.py data/interim "$layer"
    python -I pipeline/validate.py data/interim "$layer"
  done
  ```
  If `~/.config/analog-finder/ee-key.json` (or `$EE_KEY`) exists, also run `python -I pipeline/experiment_window.py data/interim "$layer"` per layer; otherwise skip and note that experiment windows are stale (they use the Mars daily range, which changed).
  Then `python -I pipeline/export.py data/interim out`. Expected: no errors; export prints top cells and areas per layer.

- [ ] **Step 2: Compare results.** With `git diff --stat out/` and a short script: method-check percentiles per check (old from `git show HEAD:out/validation_1-5m.json` vs new), the number of known analogs ≥ 90 and contrasts passing, and whether the top area per region type changed. Expected: results recorded; no threshold changed to keep them.

- [ ] **Step 3: Docs.** Spec §5: replace "Sześć miejsc ma 260–267 K, Hellas 276 K" with the new range and add the albedo/TI source. §11: replace the "te same albedo (0,25) i bezwładność (250)" bullet with the per-site sources and the model-vs-MCD/Phoenix result in K. §12: remove the done item "Albedo i bezwładność cieplna per miejsce …, sprawdzenie modelu Marsa na danych Phoenix MET". `DECISIONS.md`: one row: per-site TES albedo + Putzig & Mellon 2007 TI; reason: per-site temperature was latitude only. README: adjust the "six of the seven are within 6 K" bullet only if the spread changed. If experiment windows are stale, say so in §11.

- [ ] **Step 4: Commit.**

```bash
git add out/ docs/superpowers/specs/2026-11-15-drilling-analog-design.md docs/DECISIONS.md README.md
git commit -m "data: re-run pipeline with per-site TES Mars surface properties"
```
