# GUI "Mirror" View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public "Analog Finder" website: Mars (site pins + soil-layer picker) on the left, Earth with the similarity heat map in the centre, analog card on the right, with a choreographed intro and interaction motion.

**Architecture:** Vite + React + TypeScript app in `app/`. One r3f `<Canvas>` renders two drei `<View>`s (Mars, Earth) into DOM slots; HTML UI sits beside them. All contract data goes through one data module (`src/data/`) reading the contract files from a base URL, so mock vs real data is only a URL. App state is one zustand store; pure logic (data, geo, store, click resolution) is unit-tested with Vitest; visuals are verified with a running dev server and Playwright screenshots.

**Tech Stack:** react@18.3.1, three@0.169.0, @react-three/fiber@8.17.10, @react-three/drei@9.114.0, @react-three/postprocessing@2.16.3, gsap@3.12.5, zustand@4.5.5, vite@5.4.10, typescript@5.6.3, vitest@2.1.4, @testing-library/react@16.0.1, jsdom@25.0.1, pngjs@7.0.0 (dev, mock data).

**Spec:** `docs/superpowers/specs/2026-11-14-gui-mirror-design.md` (read it fully first). Contract: `docs/contracts/analysis-to-gui/CONTRACT.md` (v0.2 in repo; v0.3 changes are listed in spec §10). Mockup: tab *Mirror v2* of https://claude.ai/artifact/GFfenWpzGFK17ndGGD2mR9 (illustrative only).

## Before you start (clean session)

```bash
git checkout gui-design
cd app   # created in Task 1
```
Node 24 / npm 11 are installed. Python 3.11 with Pillow is installed (Task 7).

## Global Constraints

- All user-facing text in English.
- Missing data (`null`) is shown as "no data", never as a 0 / weak score.
- Coordinates east-positive, −180…180 on both planets; GeoJSON `[lon, lat]`.
- White is the only UI accent; colour lives only in planet imagery. 1px lines. Dark space background.
- Type: geometric grotesk (Sora for display, Inter for text, JetBrains Mono for numbers) via Google Fonts with system fallbacks.
- No connector/arrow line between Mars and Earth. No fast spins, particle stars, bouncing/gradient text, colour flashes, auto carousels, cards over the globe, tall pins, stylised globe textures.
- Moon, progression/unlocking/finale, share link/image, generated video, sound: out of scope.
- `prefers-reduced-motion: reduce` → every timeline becomes a ≤200 ms cross-fade; intro skipped.
- Touch targets ≥ 44 px; pins, layer slabs and card arrows reachable with Tab / Enter / ← →, visible focus.
- Performance: main JS chunk ≤ 350 kB gzip; 2k textures on screens ≤ 700 px wide, 4k otherwise; textures and score PNGs load lazily after first paint.
- Data base URL from `import.meta.env.VITE_DATA_BASE` (default `/mock-data/`). Real data: copy `out/` to `app/public/data/` and set `VITE_DATA_BASE=/data/` (the team owns this wiring).
- Layout breakpoint: phone ≤ 700 px (Mars + soil picker side by side on top, Earth middle, card as bottom sheet).

## Review Focus

1. Click on ocean / outside permafrost (PNG alpha 0) → "No permafrost here", never a score → test in Task 5.
2. Selecting a layer with `available: false` (1–5 m, > 5 m) → no fetch of missing files, card and map dimmed with "Layer not delivered yet" → tests in Tasks 3 and 5.
3. A site with fewer than 10 cells in `cells_top` → counter reads "k / k", arrows wrap within k → test in Task 4.
4. Cells and clicks near the antimeridian (Arcadia Planitia is at −170°) → nearest-cell search and PNG sampling wrap across ±180 → tests in Tasks 3 and 4.
5. `place: null` (all of v0.2) → card title shows formatted coordinates like `77.55°S 160.85°E` → test in Task 4.

---

### Task 1: Scaffold the app

**Files:**
- Create: `app/` via `npm create vite@5 app -- --template react-ts`, then `app/vite.config.ts` (Vitest config: `environment: "jsdom"`), `app/src/styles/tokens.css`, `app/src/App.tsx`, `app/src/App.test.tsx`, `app/index.html` (title "Analog Finder", Google Fonts link)
- Modify: root `.gitignore` (add `app/node_modules/`, `app/dist/`)

**Interfaces:**
- Produces: CSS tokens in `tokens.css`: `--bg:#05070b; --ink:#eef2f6; --mute:#8b95a4; --dim:#4a5361; --line:rgba(238,242,246,.16); --line2:rgba(238,242,246,.34); --frost:#d9ecfa; --panel:rgba(14,19,27,.62); --f-disp; --f-body; --f-mono` (values as in the mockup). `App` renders a layout grid with slots `data-slot="mars"`, `"soil"`, `"earth"`, `"card"`.
- npm scripts: `dev`, `build`, `test` (`vitest run`), `preview`.

- [ ] **Step 1:** Scaffold and install the Tech Stack packages at the versions above.
- [ ] **Step 2: Failing test** `App.test.tsx`: renders `<App/>`, expects text `Analog Finder` and the four `data-slot` elements.
- [ ] **Step 3:** `npm test` → FAIL. Implement `App` + tokens. `npm test` → PASS; `npm run build` succeeds.
- [ ] **Step 4: Commit** `feat(app): scaffold Vite React app with design tokens`

### Task 2: Contract types and mock data

**Files:**
- Create: `app/src/data/types.ts`, `app/scripts/make-mock-data.mjs`, `app/src/data/mock.test.ts`
- Create (generated, committed): `app/public/mock-data/` (`manifest.json`, `mars_sites.geojson`, `cells_top_0-1m.geojson`, `validation.json`, `score_0-1m_best.png`, `score_0-1m_<site>.png` ×7)

**Interfaces:**
- Produces in `types.ts` (contract v0.3): `LayerId = "0-1m"|"1-5m"|"gt5m"`, `FeatureId = "temperature"|"ground_ice"|"polygons"`, `FeatureStatus = "ok"|"no_data"|"not_relevant"|"pending"`, `Manifest`, `MarsSite` (`id,name,lat,lon,coords_status,description,citation,features`), `Cell` (`id,lat,lon,rank,percentile,score,best_site_id,site_scores: Record<string, number|null>,features,site_features: Record<string, SiteFeatures>,strengths,breaks_down,known_analog,place,experiment_window`), `SiteFeatures {temperature:number|null, ground_ice:number|null, strengths:FeatureId[], breaks_down:FeatureId[]}`, `ValidationCheck {name, role:"known_analog"|"contrast", median_percentile:number|null, passed:boolean|null, bbox:[number,number,number,number]}`. Cells are flattened from GeoJSON (`lat`, `lon` from coordinates) by the data source, not stored that way.
- `npm run mock-data` runs the generator. Deterministic (seeded PRNG). Site ids and coordinates exactly as `docs/contracts/analysis-to-gui/examples/mars_sites.geojson`. ~600 cells over real permafrost latitudes (Greenland, Canadian Arctic, Svalbard, Siberia, Tibet, Antarctic Dry Valleys), including ≥3 cells within 1° of lon ±180 and one site (`hellas_rim`) with only 6 cells where it is the best. Known analogs: McMurdo, Devon Island. PNGs 3600×1800 RGBA, R=G=B=score×255, alpha 0 outside permafrost (smooth blobs around the cells). `manifest.layers` = 0-1m available, others not.

- [ ] **Step 1: Failing test** `mock.test.ts` reads `public/mock-data` from disk: `contract_version === "0.3"`, 7 sites, every cell has `site_features` keyed by exactly `manifest.sites`, every check has a 4-number `bbox`, `score_0-1m_best.png` decodes (pngjs) to 3600×1800.
- [ ] **Step 2:** `npm test` → FAIL. Write types + generator, run `npm run mock-data`. `npm test` → PASS.
- [ ] **Step 3: Commit** `feat(app): contract v0.3 types and deterministic mock data`

### Task 3: Data source and score maps

**Files:**
- Create: `app/src/data/source.ts`, `app/src/data/scoreMap.ts`, tests `source.test.ts`, `scoreMap.test.ts`

**Interfaces:**
- Produces: `createDataSource(base: string, fetchImpl = fetch): DataSource` with `getManifest(): Promise<Manifest>`, `getMarsSites(): Promise<MarsSite[]>`, `getCells(layer: LayerId): Promise<Cell[]>`, `getScoreMap(layer: LayerId, site: string | "best"): Promise<ScoreMap>`, `getValidation(): Promise<ValidationCheck[]>`. File names come from `manifest.files`; a layer with `available: false` or no file entry rejects with `LayerUnavailableError` and does not fetch. Results are memoised per URL.
- `class ScoreMap { constructor(img: {width:number; height:number; data: Uint8ClampedArray}); sample(lat:number, lon:number): number|null; isPermafrost(lat,lon): boolean; topThreshold(fraction:number): number; texture data access for the shader }`. Pixel for lat/lon: `x = floor((lon+180)/360*width) mod width`, `y = clamp(floor((90-lat)/180*height))`. `sample` returns `null` when alpha = 0. `topThreshold(0.1)` = score value at the 90th percentile of alpha>0 pixels.
- `decodePng(url): Promise<ImageData-like>` in browser via `createImageBitmap` + `OffscreenCanvas` (fallback `<canvas>`).

- [ ] **Step 1: Failing tests**
  - `getCells("1-5m")` rejects `LayerUnavailableError`; fetch spy called only for `manifest.json`.
  - `getCells("0-1m")` returns cells with `lat/lon` from coordinates.
  - ScoreMap on a 360×180 synthetic image: `sample(0, 179.95)` and `sample(0, -179.95)` read the last/first column; alpha-0 pixel → `null`; `topThreshold(0.1)` on scores 0..99 (all opaque) → `0.9` ±0.01.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `feat(app): data source and score map sampling`

### Task 4: Cell logic

**Files:**
- Create: `app/src/data/cells.ts`, `cells.test.ts`

**Interfaces:**
- Produces:
  - `topForSite(cells: Cell[], siteId: string | null, n = 10): Cell[]` — sorted by `site_scores[siteId]` desc (null last); `siteId === null` → by `score`.
  - `nearestTopCell(cells: Cell[], lat: number, lon: number, radiusDeg = 0.15): Cell | null` — great-circle distance, wraps ±180.
  - `featuresFor(cell: Cell, siteId: string | null): CardFeatures` → `{rows: {id: FeatureId, score: number|null, status: FeatureStatus}[], strengths: FeatureId[], breaks: FeatureId[], vsSiteId: string|null}`. Uses `cell.site_features[siteId]` when present (`vsSiteId: null`); otherwise falls back to `cell.features` and sets `vsSiteId = cell.best_site_id` when it differs from `siteId`. Polygons row always from `cell.features.polygons.status`.
  - `formatCoords(lat, lon): string` → `"77.55°S 160.85°E"` (2 decimals, N/S/E/W).
  - `placeLabel(cell): string` → `cell.place ?? formatCoords(cell.lat, cell.lon)`.

- [ ] **Step 1: Failing tests** — `topForSite` with a site having 6 cells returns 6; nearest across antimeridian (`lon 179.95` found from click at `-179.98`); `featuresFor` fallback sets `vsSiteId`; `null` score keeps status `no_data`; `placeLabel` with `place: null` → `"77.55°S 160.85°E"`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `feat(app): cell ranking, nearest-cell and card feature logic`

### Task 5: App store and Earth click resolution

**Files:**
- Create: `app/src/state/store.ts`, `store.test.ts`

**Interfaces:**
- Consumes: Task 3 `DataSource`, `ScoreMap`; Task 4 functions.
- Produces: `useAppStore` (zustand) with state
  `{ manifest, sites, cells, scoreMap, siteId: string|null, layer: LayerId, layerPending: boolean, list: Cell[], index: number, earthHit: EarthHit|null, showAll: boolean, validationOpen: boolean, focus: {lat:number; lon:number}|null }`
  where `EarthHit = {kind:"cell"; cell:Cell} | {kind:"score"; score:number; lat:number; lon:number} | {kind:"none"; lat:number; lon:number}`, and actions:
  - `init(ds: DataSource)` — loads manifest, sites, cells(`0-1m`), `best` map; `siteId=null`, `list=topForSite(cells,null)`, `index=0`.
  - `selectSite(id)` — loads that site's map, `list=topForSite(cells,id)`, `index=0`, `earthHit=null`, `focus` = list[0].
  - `selectLayer(layer)` — unavailable → `layerPending=true`, keeps current data; available → reload.
  - `step(delta: 1|-1)` — wraps within `list.length`, updates `focus`.
  - `clickEarth(lat, lon)` — `nearestTopCell` hit → `{kind:"cell"}`; else `scoreMap.sample` number → `{kind:"score"}`; null → `{kind:"none"}`.
  - `toggleShowAll()`, `openValidation(open)`, `focusCheck(check)` (sets `focus` to bbox centre).
  - Selector `currentCell(state): Cell | null` = `earthHit.kind==="cell" ? earthHit.cell : list[index] ?? null`.

- [ ] **Step 1: Failing tests** (store built with an in-memory DataSource over mock data): init → `siteId null`, `currentCell` = global #1; `selectSite("hellas_rim")` → `list.length===6`, `step(1)` ×6 wraps to index 0; `selectLayer("1-5m")` → `layerPending` true, no fetch; `clickEarth` on ocean → `kind "none"`; on a permafrost pixel far from cells → `kind "score"`; `toggleShowAll` survives `selectSite`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `feat(app): app store with site, layer, stepping and earth click resolution`

### Task 6: Geometry helpers

**Files:**
- Create: `app/src/scene/geo.ts`, `geo.test.ts`

**Interfaces:**
- Produces: `ll2v(lat, lon, r = 1): THREE.Vector3` and `v2ll(v): {lat, lon}` using the exact formulas in `context/ui-setup-reference.md` §4.3 (they match `SphereGeometry` UVs); `isClick(down: {x,y}, up: {x,y}): boolean` (< 6 px); `facesCamera(pointWorld, camera): boolean` (dot of normal and camera direction > 0.05).

- [ ] **Step 1: Failing tests** — round trip `v2ll(ll2v(lat, lon))` within 1e-6 for (42, −170), (−77.55, 160.85), (0, 180); `isClick` 5 px → true, 7 px → false.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `feat(app): globe geometry helpers`

### Task 7: Planet textures

**Files:**
- Create: `scripts/fetch_textures.py`
- Create (committed): `app/public/textures/earth_color_4k.jpg`, `earth_color_2k.jpg`, `mars_color_4k.jpg`, `mars_color_2k.jpg`
- Modify: `research/sources.md` (create if missing) — add both sources with URLs

**Interfaces:**
- Produces: equirectangular JPEGs, left edge = 180°W, 4096×2048 and 2048×1024, each < 3 MB (lower JPEG quality if needed).
- Earth: NASA Blue Marble Next Generation, July, no clouds (`https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200407.3x5400x2700.jpg`), resized with Pillow.
- Mars: Viking MDIM 2.1 colour via NASA Trek tiles, zoom 3, stitched as in `context/ui-setup-reference.md` §3.1 (`https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/<z>/<row>/<col>.jpg`).
- Run with `python -I scripts/fetch_textures.py app/public/textures`; downloads go to a fresh temp dir.

- [ ] **Step 1:** Write and run the script. If a URL fails, stop and report it.
- [ ] **Step 2: Verify** 4 files exist with the right sizes (`python -c "from PIL import Image; ..."`), each < 3 MB.
- [ ] **Step 3: Commit** `feat(app): Earth and Mars colour textures`

### Task 8: Scene shell and Mars globe

**Files:**
- Create: `app/src/scene/Stage.tsx` (one `<Canvas>` + drei `<View>` per slot, `eventSource` = app root), `app/src/scene/MarsGlobe.tsx`, `app/src/scene/useTextureSize.ts`
- Modify: `app/src/App.tsx` (mount Stage, `useAppStore.init(createDataSource(import.meta.env.VITE_DATA_BASE ?? "/mock-data/"))`)
- Test: `app/src/scene/useTextureSize.test.ts`

**Interfaces:**
- Consumes: store (`sites`, `siteId`, `selectSite`), `ll2v`, `facesCamera`.
- Produces: `MarsGlobe` — textured sphere, slow idle rotation (≤ 0.02 rad/s), drag to rotate, no zoom; pins = small ring meshes at `ll2v(lat, lon, 1.01)` plus drei `<Html>` `<button aria-label={name}>` hit targets (≥ 44 px, keyboard focusable), hidden when `!facesCamera`. Selected pin filled; label shown on hover/focus/selected. `rotateTo(lat, lon)` imperative handle used by Task 11.
- `useTextureSize(): "2k"|"4k"` — `"2k"` when `matchMedia("(max-width: 700px)")` matches.
- If WebGL is unavailable, the slot shows "Your browser can't show the 3D globes." and the card still works.

- [ ] **Step 1: Failing test** for `useTextureSize` with mocked `matchMedia`. FAIL → implement → PASS.
- [ ] **Step 2:** Implement Stage and MarsGlobe. **Verify** with `npm run dev` + Playwright screenshot at 1440×900 and 390×844: Mars visible on the left, 7 pins at plausible places (Hellas rim in the southern hemisphere, Deuteronilus near 22°E), clicking a pin selects it (store `siteId` changes).
- [ ] **Step 3: Commit** `feat(app): scene shell and Mars globe with site pins`

### Task 9: Earth globe, heat map shader, outline, pulse, validation boxes

**Files:**
- Create: `app/src/scene/EarthGlobe.tsx`, `app/src/scene/heatMaterial.ts`, `app/src/scene/heat.ts`, `heat.test.ts`, `app/src/scene/Pulse.tsx`, `app/src/scene/ValidationBoxes.tsx`

**Interfaces:**
- Consumes: store (`scoreMap`, `showAll`, `focus`, `clickEarth`, validation checks, `validationOpen`), `ll2v`, `v2ll`, `isClick`.
- Produces:
  - `heatAlpha(score: number, alpha: number, threshold: number, showAll: boolean): number` in `heat.ts` — the JS twin of the GLSL function; 0 when alpha = 0; when `!showAll` 0 below `threshold`; otherwise opacity ramps up with score. The shader in `heatMaterial.ts` implements the same formula (keep them in sync; comment says so).
  - Shader uniforms: `uScore` (score PNG texture), `uThreshold`, `uShowAll`, `uOrigin` (vec3 unit vector of the reveal origin), `uReveal` (0..π, angular radius revealed), `uOutline` (opacity of the permafrost contour, derived from alpha gradient in the shader, 1px-ish, low opacity). Colour range: transparent → `--frost` white only.
  - Earth: satellite texture + heat overlay sphere (r = 1.002), drag rotate, scroll/pinch zoom (distance 1.4–6), click → `clickEarth(v2ll(hit))` only when `isClick`. `flyTo(lat, lon)` imperative handle used by Task 11.
  - `Pulse` — 3 thin white rings on `focus`, staggered.
  - `ValidationBoxes` — when `validationOpen`, bbox outlines on the sphere: `known_analog` solid, `contrast` dashed (`LineDashedMaterial`).
- `ShowAllToggle` button lives in Task 10.

- [ ] **Step 1: Failing tests** for `heatAlpha`: alpha 0 → 0; score 0.5 with threshold 0.8 and `showAll=false` → 0; same with `showAll=true` → > 0; score 0.95 → > score 0.85 result.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** in the dev server: only top-10 % blobs visible; "Show all" (toggle via store in devtools until Task 10) shows the full range; contour line visible around permafrost; clicking the ocean sets `earthHit.kind === "none"`; pulse sits on the best cell.
- [ ] **Step 4: Commit** `feat(app): Earth globe with heat map shader, contour, pulse and validation boxes`

### Task 10: HTML UI — soil picker, analog card, validation panel, toggle, footer, phone layout

**Files:**
- Create: `app/src/ui/SoilPicker.tsx`, `AnalogCard.tsx`, `ValidationPanel.tsx`, `ShowAllToggle.tsx`, `Footer.tsx`, `app/src/ui/ui.css`, tests `AnalogCard.test.tsx`, `SoilPicker.test.tsx`
- Modify: `app/src/App.tsx`, `app/src/styles/tokens.css` (phone layout ≤ 700 px)

**Interfaces:**
- Consumes: store selectors/actions, `featuresFor`, `placeLabel`, `formatCoords`.
- Produces (copy is exact):
  - `SoilPicker` — cut block of 3 slabs (thicker with depth), labels from `manifest.layers[].label`, `aria-pressed`; unavailable slabs dashed with "coming".
  - `AnalogCard` — glass panel beside Earth. Shows: `#{index+1} for {siteName}` (or `Best overall` when `siteId` null), small `Global rank #{rank}`, `placeLabel`, big score (`site_scores[siteId]` or `score`), feature rows (bar for `ok`; text `Pending`, `No data`, `Not relevant` otherwise), strengths ✓ / breaks ✗ markers, `vs {siteName}` caption when `vsSiteId`, `known_analog` chip, experiment window line `Test window: {months as Jun–Aug} · {hours_per_year} h/yr` when present, arrows `←` `→` with `{index+1} / {list.length}` (keyboard ← → when card focused).
  - Mini states: `{kind:"score"}` → `Similarity {score}` + `Outside top cells — no feature details`; `{kind:"none"}` → `No permafrost here`; `layerPending` → card dimmed + `Layer not delivered yet`.
  - `ValidationPanel` — badge `Method check {passed}/{total}` opens list: name, role, median percentile, passed ✓/✗; clicking an entry calls `focusCheck`.
  - `ShowAllToggle` — small button in Earth slot corner, text `Show all` / `Top 10 %`.
  - `Footer` — sources from `manifest.sources` as links.

- [ ] **Step 1: Failing tests** — card renders `77.55°S 160.85°E` when `place` null; renders `Pending` for polygons; `kind "none"` renders `No permafrost here` and no score; `vs Arcadia Planitia` when fallback; SoilPicker marks `1–5 m` slab with "coming" and calls `selectLayer`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** Playwright screenshots at 1440×900 and 390×844: card never overlaps the Earth globe; phone layout as in Global Constraints; Tab reaches pins, slabs, arrows with visible focus.
- [ ] **Step 4: Commit** `feat(app): soil picker, analog card, validation panel and phone layout`

### Task 11: Motion — intro and interaction timelines

**Files:**
- Create: `app/src/motion/timelines.ts`, `app/src/motion/intro.ts`, `intro.test.ts`, `app/src/motion/useMotion.ts`
- Modify: `MarsGlobe.tsx`, `EarthGlobe.tsx`, `SoilPicker.tsx`, `AnalogCard.tsx` (expose refs / hooks the timelines drive)

**Interfaces:**
- Produces:
  - `chooseIntro(seen: boolean, reducedMotion: boolean): "full" | "short" | "none"`; `readSeen()/markSeen()` using `localStorage` key `af-intro-seen`, every access in try/catch.
  - GSAP timelines (each returns `gsap.core.Timeline`, killable): `introTimeline(kind)`, `pickSiteTimeline(lat, lon, cell)`, `pickLayerTimeline(layer)`, `cardBuildTimeline(cardEl)`. Any click or key during the intro jumps it to the end.
  - Choreography (spec §6 and §9): intro full ~5 s = black + grain + stars → Mars passes close, the 7 pins flicker in turn → camera pulls back, Mars settles left, Earth rises → best heat map spreads from global #1 (`uReveal` 0→π from `uOrigin`) + pulse → card builds; short ~1.5 s = from the heat-map step. Pick site = Mars `rotateTo` with eased inertia + radar rings on Mars surface; as they finish, Earth echo: pulse + heat reveal from the site's best cell + `flyTo`. Pick layer = block splits like a core, chosen slab slides forward, others dim. Card build = border lines draw, score counts up, bars fill in order, `breaks_down` rows get a short monochrome glitch (CSS `clip-path` jitter, no colour change).
  - Reduced motion → all of the above become ≤ 200 ms cross-fades and `chooseIntro` returns `"none"`.

- [ ] **Step 1: Failing test** `chooseIntro`: `(false,false)→"full"`, `(true,false)→"short"`, `(x,true)→"none"`; `readSeen` returns false when `localStorage.getItem` throws.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** in the dev server (and record a short Playwright video or screenshot sequence): first load plays the full intro, reload plays the short one, click skips; picking a site shows ping → echo with no connector line; emulate `prefers-reduced-motion` and confirm no intro.
- [ ] **Step 4: Commit** `feat(app): intro and interaction motion timelines`

### Task 12: Post effects, lazy loading and performance check

**Files:**
- Create: `app/src/scene/Effects.tsx` (postprocessing `Noise` for grain, `Vignette`)
- Modify: `Stage.tsx`, texture loading in `MarsGlobe.tsx` / `EarthGlobe.tsx` (lazy, size from `useTextureSize`), `app/vite.config.ts` (manual chunk for three/r3f if needed)

- [ ] **Step 1:** Add Effects; textures and score PNGs start loading after first paint; first frame shows the dark scene with wordmark (intro hides the loading).
- [ ] **Step 2: Verify** `npm run build` → main chunk ≤ 350 kB gzip (read Vite's size report); `npm test` → all PASS; Playwright screenshots desktop + phone look like spec §5 sketch.
- [ ] **Step 3: Commit** `feat(app): grain and vignette, lazy textures, bundle budget`
