# GUI design: "Mirror" view

Date: 2026-11-14. Status: draft for team approval.
Inputs: `context/gui-guidlines.md` (earlier brief, not binding), `context/gui_inspirations.md`,
`docs/contracts/analysis-to-gui/CONTRACT.md` (v0.2), concept mockups
(artifact "Analog Finder Concepts", tab *Mirror v2*).
Terms (Earth Cell, Mars Base Candidate Site, Depth Layer, Known Analog) follow `GLOSSARY.md`.
User-facing text is English.

## 1. Intent

A visitor picks one of 7 Mars Base Candidate Sites and one Depth Layer and sees where on Earth's
permafrost the closest analogs are, what matches and where the analogy breaks down. Feel:
minimal, futuristic, cinematic. The animations must be a highlight of the final build, not
default fades.

Audience: space and popular-science fans visiting the public website (judges are a subset).
Real data from the analysis pipeline, no fictional narrative.

## 2. Goals, non-goals, anti-goals

Goals
- One scene: Mars (left), Earth (centre, large), analog card (right).
- Mars sites sit at their real coordinates on the Mars globe; clicking one selects it.
- A soil cross-section under Mars selects the Depth Layer.
- Earth shows the similarity heat map for the chosen site + layer and highlights the best cell.
- Card shows the selected cell: score, rank, per-feature scores, what is similar (`strengths`),
  where it breaks down (`breaks_down`), known analog, place.
- Distinctive, choreographed animation (section 6).
- Desktop and phone from day one. Fast first load.

Non-goals (for now)
- Moon. It is not in the data.
- Progression / unlocking / finale montage from the earlier brief (team confirmed: dropped).
- Optimising for a one-off demo. The target is the public website: all of section 6 is in scope,
  and performance targets mid-range phones as well as desktops.
- Higgsfield or other generated video. Slots may be added later (intro, loading, layer backgrounds);
  generated imagery must never stand in for a real place.
- Data wiring details: the team handles loading/connectors. This doc fixes what is shown and how
  it behaves, against the contract's shapes.

Anti-goals (fails even if it works)
- Generic, template-looking UI or plain fade-in animations.
- A connector/arrow line between Mars and Earth (rejected by the team).
- Showing missing data (`null`) as a weak score.
- Slow globe loading (rejected inspirations: globaldatatracker, thecosmicstage).
- From the inspiration "minus" list: fast planet spin, moving star particles, bouncing text,
  colourful blur borders, black+cyan "tech" palette, serif/pixel fonts, cards covering the globe,
  tall elaborate pins, stylised globe textures, auto carousels.

## 3. Constraints

- Data: contract v0.2 files (`manifest.json`, `mars_sites.geojson`, `cells_top_<layer>.geojson`,
  `score_<layer>_<site_id>.png` + `score_<layer>_best.png`, `validation.json`).
  Only layer `0-1m` exists now; features `temperature` and `ground_ice`; `polygons` is `pending`.
- `cells_top` holds the 2000 best cells per layer. Everything else is only a 0–1 value in the PNG.
- Coordinates: east-positive, −180…180 on both planets; GeoJSON `[lon, lat]`.
- PNG: 3600×1800 equirectangular, R = score×255, alpha 0 = no permafrost/data. The GUI colours it.
- Read `manifest.json` first; which layers are available comes from `layers[].available`.

## 4. Approaches considered

1. **React + react-three-fiber + GSAP + postprocessing, Vite build.** *Chosen.* One GSAP timeline
   drives both 3D scenes and the HTML card; postprocessing gives grain/vignette/glitch; custom
   shader for the heat-map reveal. Cost: a build step and ~300 kB gz bundle, kept fast with lazy
   texture loading.
2. Plain three.js + GSAP, no build (as in `context/ui-setup-reference.md`). Lightest, proven
   before, but UI state and multi-scene choreography are hand-written; polish costs more time.
   Rejected because animation quality is the priority.
- Dropped early: Cesium / deck.gl (heavy, slow, impose their own globe look), Svelte/Threlte
  (new stack, no clear gain).

## 5. Screen and behaviour

```
 Mars · pick a base site                                 ┌ Best twin · #1 ───┐
   ╭────────╮                    ╭──────────────╮        │ Beacon Valley     │
  │ ○  ●    │                  ╱  ░▒▓  ◉ pulse   ╲       │ Antarctica        │
  │   ○  ○  │                 │   heat map        │      │ 0.91 match        │
   ╰────────╯                 │   (chosen site)   │      │ temperature ▬▬▬▬  │
  Ground layer to match        ╲     EARTH        ╱      │ ground ice  ▬ ▬ ▬ │
  ▱▱▱▱▱▱▱▱▱▱▱                    ╰──────────────╯        │ polygons  pending │
  [ 0–1 m  dig-able ice ]                                │ McMurdo DV  3/10 ←→│
  [ 1–5 m  coming       ]                                └───────────────────┘
  [ > 5 m  coming       ]
```

### 5.1 Mars globe
- 7 pins from `mars_sites.geojson` at real lat/lon. Small, low, 1px white ring; selected = filled.
- Name label on hover/focus and for the selected pin.
- Click a pin: Mars rotates (with inertia) to centre it; pins on the far side hide and return.
- Drag rotates; no zoom needed on Mars. *(my call)*
- On load no site is selected (see section 8, start state).

### 5.2 Soil cross-section (Depth Layer picker)
- A small cut block under Mars: three slabs, thicker with depth, labels from `manifest.layers[].label`.
- Selected slab is filled white. Layers with `available: false` are dashed, clickable, and show
  "coming"; the Earth map and card dim and say the layer is not delivered yet.

### 5.3 Earth globe
- Real satellite colour texture (no stylised texture) + similarity map from
  `score_<layer>_<site_id>.png`, coloured in the GUI in the white/frost range only.
- Pulse (thin concentric white rings) on the selected cell.
- Drag rotates, scroll/pinch zooms.
- **Click on Earth** (pointer moved < 6 px):
  - near a cell from `cells_top` → card switches to that cell (full detail). "Near" radius is
    the builder's call (start with ~1 cell / a few px on screen).
  - elsewhere inside permafrost → mini card: score read from the PNG for this site, "outside
    top 2000", no features.
  - outside permafrost (alpha 0) → "no permafrost here". Never a 0 score.
- No connector line between Mars and Earth. The link is shown by timing: the Mars site "pings",
  Earth "echoes" with the pulse on the best cell (section 6).

### 5.4 Analog card
- Right side, never over the globe. Glass panel (blur), 1px border.
- Content from the cell: rank, place (fallback to coordinates while `place` is `null`),
  overall `score`, per-feature score bars, status per feature (`pending`, `no_data`,
  `not_relevant` shown as text, not as an empty bar), `strengths` / `breaks_down` marked,
  `known_analog` chip.
- Experiment window for the selected site (`experiment_window[site]`): months + hours/year,
  one line. *(my call: include; info only)*
- Arrows ← → step through the top 10 cells for the selected site + layer, ordered by
  `site_scores[site]`; counter "3 / 10". Each step flies Earth's camera to the cell.
- Scores shown for the selected site use `site_scores[site]`; per-feature details are only
  available relative to `best_site_id` in v0.2. When the selected site ≠ `best_site_id`, show the
  overall site score and label the feature bars "vs <best site name>". *(my call; flag to analysis
  team as a possible contract change)*

### 5.5 Supporting UI
- Small top-left wordmark; small badge "Method check 3/3" opening `validation.json` results.
- Sources link (from `manifest.sources`) in a quiet footer.
- Optional ambient sound with an obvious mute toggle, off by default. *(my call)*

### 5.6 Phone
- Mars + soil block side by side at the top, Earth in the middle, card as a bottom sheet.
- Tap selects, drag rotates. Touch targets ≥ 44 px.

## 6. Motion (the signature)

All motion is driven from one GSAP timeline per interaction. Respect `prefers-reduced-motion`
(replace with short cross-fades).

1. **Pick site**: Mars rotates to the pin with eased inertia; thin radar rings sweep out from it
   across the surface.
2. **Ping → echo**: as the Mars rings finish, Earth answers: the pulse appears on the best cell
   and the heat map *spreads outward from that cell* (shader reveal driven by distance from the
   cell, not a fade). Camera eases to the cell.
3. **Pick layer**: the soil block opens like a split core sample; the chosen slab slides forward,
   the others dim.
4. **Card build**: border draws as lines first, then numbers count up to the score, feature bars
   fill one by one; features in `breaks_down` get a brief monochrome glitch (no colour shift).
5. **Ambient**: subtle film grain, vignette, static stars, slow idle rotation of both planets.

Banned: fast spins, particle stars, bouncing/gradient text, colour flashes.

## 7. Visual system

- Dark space background, white as the only UI accent, 1px lines; colour lives only in the planet
  imagery.
- Geometric grotesk type (mockup used Sora / Inter / JetBrains Mono for data); final pick is the
  builder's.
- Glass panels with blur for the card; status chips for states.

## 8. Data boundary and states (resolved after builder review)

- **Data boundary** *(my call)*: the UI talks to one small data module with a fixed interface
  (`getManifest()`, `getMarsSites()`, `getCells(layer)`, `getScoreMap(layer, siteId | "best")`,
  `getValidation()`, plus helpers `sampleScore(layer, site, lat, lon)` → number | null and
  `nearestTopCell(layer, lat, lon, radius)`). The builder ships a mock adapter reading
  `docs/contracts/analysis-to-gui/examples/`; the team swaps in the real loader for `out/`.
- **Mock PNGs** *(my call)*: no `score_*.png` exists yet and `examples/` is still contract v0.1.
  The builder generates mock 3600×1800 PNGs (e.g. smooth blobs over permafrost latitudes) and
  updates the mock adapter to the v0.2 shapes, so the shader, reveal and click sampling can be
  tested now.
- **Best cell / top-10 for a site** *(my call)*: taken from `cells_top` sorted by
  `site_scores[site]`. For weaker sites their true best may be missing from the file; accepted
  for now, flagged to the analysis team (option: per-site top lists in the contract).
- **Rank on the card** *(my call)*: big = position for the selected site ("#3 for Arcadia
  Planitia", same list as the ← → counter); small secondary line = global `rank`.
- **Start state** *(my call)*: on load no site is selected; Earth shows `score_<layer>_best.png`
  with the pulse on global #1, card shows that cell. Picking a site switches to its map. This
  replaces "default = first site" in 5.1.
- **Mockup**: artifact "Analog Finder Concepts", tab *Mirror v2*
  (https://claude.ai/artifact/GFfenWpzGFK17ndGGD2mR9, private, share via its Share menu).
  Illustrative for layout and mood, not binding for proportions or fonts.

## 9. Decisions from the grilling session (team answers)

- **Intro** (~5 s), ends on the most important view: black + grain + stars → Mars passes close,
  the 7 site pins flicker in turn → camera pulls back, Mars settles left, Earth rises → "best"
  heat map spreads, pulse on global #1 → card draws itself and counts up. Click / any key skips.
  Full version on first visit, ~1.5 s version (from the heat-map step) on later visits.
  No separate title screen.
- **Share link / share image**: skipped for now.
- **Heat map**: show only the top 10 % of permafrost cells of the current map (computed per
  selected site's map). A small "Show all" toggle in the corner by Earth shows the full scale.
  Toggle state persists across site and layer changes.
- **Permafrost outline**: thin 1px low-opacity contour on Earth, derived from the PNG alpha.
- **Validation highlight**: in scope now. Each `validation.json` check gets a `bbox`
  (contract change; the boxes already exist in `pipeline/validate.py`). On Earth: known analogs =
  solid white outline, contrast = dashed. Clicking an entry in the panel flies the camera there.
- **Keyboard**: pins, layer slabs and card arrows work with Tab / Enter / arrow keys, visible focus.
- **Per-site feature scores**: see open item in section 10.

## 10. Open items

- Feature bars for a selected site ≠ `best_site_id` (contract v0.2 only has them vs the best
  site). Pending decision: change `pipeline/export.py` to emit per-site feature scores.

## 11. Left to the builder

- Project layout, component structure, state management.
- Data loading and wiring (team-owned).
- Exact easing/durations, shader implementation, postprocessing stack.
- Texture sources and sizes (see `context/ui-setup-reference.md` §3 for prior sources), as long as
  the first load stays fast.
- Click-snap radius, top-N default (10) tuning.
