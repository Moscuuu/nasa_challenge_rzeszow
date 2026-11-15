# Per-site Mars thermal properties from TES (short design)

Date: 2026-11-15. Size: small change. Builds on `2026-11-15-drilling-analog-design.md` §5, §11, §12.

## Intent

Every Mars Base Candidate Site currently runs the thermal model with the same albedo (0.25) and thermal inertia (250), so per-site temperatures differ only by latitude. Replace the shared guess with orbital measurements so each site's `summer_tmax` (the only site-dependent score input) can be defended. Success = the numbers are grounded and checked; maps changing visibly is a bonus, not a goal.

## Goals / non-goals

- Goal: albedo and thermal inertia per site from TES; model error stated in K against independent references.
- Non-goal: SWIM ice depth per site in `ice_table` (option B; separate step, needs team agreement per `DECISIONS.md`).
- Non-goal: changing thresholds, `SUMMER_T_SCALE_K`, features or the GUI.
- Anti-goal: tuning anything to make sites differ or to pass the method check.

## Approaches considered

1. **TES maps into our model** (`mars_thermal.py`): chosen. Small, keeps daily profile and depth temperatures consistent with the score temperature.
2. KRC (Kieffer) instead of our model: most standard, but replaces working code and needs a web tool or Fortran install. Overkill now.
3. Mars Climate Database surface temperature directly: full GCM, but only temperatures; daily profile and depth temps would come from a different model. Used as cross-check instead.

## Design

- **Data:** TES albedo (Christensen et al. 2001, `global_albedo_8ppd.img`) and thermal inertia (Mellon et al. 2000, `global_ti_60n_50s_8ppd.img`), PDS Geosciences TES special products. New fetch script in `pipeline/`, raw files in `data/raw/tes/`.
- **Per site:** mean of valid pixels in the same 1° window as SWIM (`WINDOW_DEG`). Values and source go into `mars_sites.json` (`albedo`, `thermal_inertia`, plus a source/citation field) and from there to the contract.
- **Phoenix check:** run the model at the Phoenix site (68.22°N, 234.3°E) with TES values there; compare summer daily max/min against Phoenix data. MET is air at 1 m, not surface: preferred reference is TECP soil data if obtainable; otherwise MET is reported as a lower bound for surface tmax only, not a 1:1 comparison.
- **MCD cross-check:** daily max mean surface temperature from MCD v6.1 web interface, local summer, at the 7 sites + Phoenix (8 manual queries; moderate use is allowed). Report our model vs MCD per site in K.
- **Re-run:** `mars_sites` → `score` → `validate` → `export` for 3 layers. `experiment_window` needs Earth Engine; rerun if key available, otherwise flag as stale.
- **Report:** short table (site, old vs new albedo/TI, old vs new summer_tmax, MCD, delta) added to the main spec §5/§11, and a line in `DECISIONS.md`.

## Left to the builder

- If the TES TI map (60°N–50°S) does not cover Phoenix (68°N), use Putzig & Mellon 2007 maps for **all** 8 points so one source is used throughout.
- Handling interpolated TI pixels (mask them out where the interpolation mask exists).
- Exact MCD scenario (climatology, default dust) and how local summer is averaged; state the choice.
