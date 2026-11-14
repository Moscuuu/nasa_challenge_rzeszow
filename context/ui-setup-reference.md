# New analog-finder project: setup guide

How to rebuild the base of the NASA Space Apps "Analog Finder" for a new project:
tools, Google Cloud / Earth Engine, planet data, the 3D globes, the UI shell, the dev
loop and deployment. Everything here was tested in the 2026 project
(Windows 11, Python 3.11, GDAL 3.12, Google Cloud SDK 555, three.js 0.160).

Replace these placeholders throughout:

| Placeholder | Example |
| --- | --- |
| `<PROJECT_ID>` | `my-analogs-2027` (globally unique, lowercase) |
| `<APP>` | `my-analogs` (folder name for local secrets) |
| `<SA_NAME>` | `my-analogs-ee` (service account name) |

---

## 0. Stack at a glance

- **No build step.** Plain `index.html` + ES modules. three.js loaded from a CDN via an import map.
- **Python scripts** for data prep (GDAL CLI, numpy, Pillow, `earthengine-api`).
- **Textures**: one 4096×2048 equirectangular JPEG per body for colour and one for height (8-bit grayscale).
- **Earth Engine** only for high-res Earth DEMs (Copernicus GLO-30). Moon/Mars data is downloaded once.
- **Deploy**: a script copies the app into one self-contained folder, then drag it onto Netlify Drop.

Folder layout:

```
research/          notes, sources.md, papers
data/raw/{earth,mars,moon}/   original downloads (gitignored, big)
data/processed/    JSON outputs, intermediate grids
prototypes/globe/  standalone globe + textures/
prototypes/app/    the real UI (index.html, js/, tests/)
scripts/           ee_init.py, make_textures.ps1, serve.py, build_netlify.py, metrics…
dist/              build output for Netlify
```

`.gitignore` essentials:

```gitignore
data/raw/**
!data/raw/**/.gitkeep
*.tif
*.tiff
*.img
*.cub
*.IMG
__pycache__/
.venv/
node_modules/
*-key.json
```

---

## 1. Install tools (Windows, ~20 min)

Run in PowerShell:

```powershell
winget install Python.Python.3.11
winget install OpenJS.NodeJS.LTS          # only for `node --test`
winget install GISInternals.GDAL          # gdal_translate, gdalinfo, gdalwarp
winget install Google.CloudSDK            # gcloud
winget install Git.Git
```

GDAL from GISInternals needs env vars. If `gdalinfo --version` fails in a new terminal, add
to your user environment: the GDAL `bin` folder on `PATH`, `GDAL_DATA` → `...\gdal-data`,
`PROJ_LIB` → `...\projlib` (paths are shown at the end of the installer).

Python packages:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install earthengine-api numpy pillow
```

Check:

```powershell
python --version; gdalinfo --version; gcloud --version; node --version
```

If PowerShell refuses to run `.ps1` scripts: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

## 2. Google Cloud + Earth Engine (~20 min)

### 2.1 Project

```powershell
gcloud auth login
gcloud projects create <PROJECT_ID>
gcloud config set project <PROJECT_ID>
gcloud services enable earthengine.googleapis.com serviceusage.googleapis.com
```

No billing account is needed for non-commercial Earth Engine.

### 2.2 Register the project for Earth Engine

Open https://code.earthengine.google.com/register, choose **Unpaid usage → Academia/Research
or Hackathon/non-commercial**, and select `<PROJECT_ID>`. Without this step every EE call
fails with "project not registered".

### 2.3 Try the easy login first

```powershell
python -c "import ee; ee.Authenticate(); ee.Initialize(project='<PROJECT_ID>'); print(ee.Number(1).getInfo())"
```

If it prints `1`, you're done (skip 2.4). In the 2026 project Google showed
**"This app is blocked"** for the personal account (both default and `auth_mode='gcloud'`),
so we switched to a service account. That route always works.

### 2.4 Service account (the reliable route)

```powershell
gcloud iam service-accounts create <SA_NAME> --display-name "Earth Engine scripts"

gcloud projects add-iam-policy-binding <PROJECT_ID> `
  --member "serviceAccount:<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" `
  --role roles/earthengine.viewer
gcloud projects add-iam-policy-binding <PROJECT_ID> `
  --member "serviceAccount:<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" `
  --role roles/serviceusage.serviceUsageConsumer
# only if you export to EE assets: --role roles/earthengine.writer

mkdir $HOME\.config\<APP> -Force
gcloud iam service-accounts keys create $HOME\.config\<APP>\ee-key.json `
  --iam-account "<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com"
```

> **The key is a password.** Keep it outside the repo (`~/.config/<APP>/`), never commit it,
> never paste it into chats or tools. If it leaks: `gcloud iam service-accounts keys list/delete`.
> If key creation is blocked by an org policy (`iam.disableServiceAccountKeyCreation`), use a
> project under your personal account instead of a workspace org.

When Claude Code runs in auto mode, it may be denied permission to run the IAM and key commands. Run them yourself
with `! <command>` in the prompt.

### 2.5 `scripts/ee_init.py`

```python
"""Initialise Earth Engine with the project's service account.
Usage: from ee_init import init; init()
"""
import os
import ee

PROJECT = "<PROJECT_ID>"
SA = f"<SA_NAME>@{PROJECT}.iam.gserviceaccount.com"
KEY = os.path.expanduser("~/.config/<APP>/ee-key.json")

def init():
    ee.Initialize(ee.ServiceAccountCredentials(SA, KEY), project=PROJECT)
    return ee

if __name__ == "__main__":
    init()
    print("Earth Engine OK:", ee.Image("USGS/SRTMGL1_003").bandNames().getInfo())
```

Test: `python scripts/ee_init.py` → `Earth Engine OK: ['elevation']`.

Useful EE datasets for analogs: `COPERNICUS/DEM/GLO30` (30 m DEM, ImageCollection → `.mosaic()`),
`USGS/SRTMGL1_003`, `MODIS/061/MOD11A2` (land surface temp), `ESA/WorldCover/v200` (land cover),
`OpenLandMap/...` (soils), `IDAHO_EPSCOR/TERRACLIMATE` (aridity).

---

## 3. Planet data → globe textures (~1.5 h, mostly downloads)

### 3.1 Sources we used

| Body | Colour | Height | File in `data/raw/` |
| --- | --- | --- | --- |
| Moon | LRO LROC WAC mosaic (NASA SVS "CGI Moon Kit") | LOLA DEM (`ldem_16/64_uint.tif`); polar: LOLA 80 m `ldem_80s_80m_float.img` | `moon/` |
| Mars | Viking MDIM 2.1 colour (USGS Astrogeology, or Trek tiles below) | MGS MOLA DEM 463 m (`Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, **not** the 11 GB 200 m one) | `mars/` |
| Earth | NASA Blue Marble Next Gen (`world.topo.bathy...jpg`) | NOAA ETOPO 2022 60″ (`ETOPO_2022_v1_60s_N90W180_surface.tif`) | `earth/` |

Record every source and citation in `research/sources.md` as you download. Judges ask about sources.

Mars colour via NASA Trek tiles (no big download), `scripts/fetch_trek_tiles.py`:

```
python scripts/fetch_trek_tiles.py Mars_Viking_MDIM21_ClrMosaic_global_232m 3 mars_color_4k.jpg
```

Zoom 3 = 4096×2048. It stitches 256 px tiles from
`https://trek.nasa.gov/tiles/Mars/EQ/<layer>/1.0.0/default/default028mm/<z>/<row>/<col>.jpg`.

### 3.2 Convert to 4096×2048 JPEGs

`scripts/make_textures.ps1` wraps `gdal_translate`:

```powershell
.\scripts\make_textures.ps1 -In data\raw\mars\viking.tif -Out mars_color_4k.jpg
.\scripts\make_textures.ps1 -In data\raw\mars\Mars_MGS_MOLA_DEM_mosaic_global_463m.tif -Out mars_height_4k.jpg -Height
.\scripts\make_textures.ps1 -In data\raw\earth\ETOPO_2022_v1_60s_N90W180_surface.tif -Out earth_height_4k.jpg -Height -SeaLevel
```

Core commands, if you rewrite it:

```powershell
# colour
gdal_translate -of JPEG -outsize 4096 2048 -co QUALITY=88 in.tif out.jpg
# height: read min/max, stretch to 0-255
gdalinfo -stats in.tif        # STATISTICS_MINIMUM / MAXIMUM
gdal_translate -of JPEG -ot Byte -scale <min> <max> 0 255 -outsize 4096 2048 -co QUALITY=90 in.tif out.jpg
```

- `-SeaLevel` sets min = 0 so Earth oceans are flat black (the app treats value 0 as ocean).
- Parse `gdalinfo` **text** output, not `-json`. PowerShell 5.1's `ConvertFrom-Json` chokes on GDAL's empty `""` metadata key.
- Target < 3 MB per JPEG. Lower `QUALITY` if bigger.
- Naming convention: `{earth,mars,moon}_{color,height}_4k.jpg` in `prototypes/globe/textures/`.

### 3.3 Polar inset (equirectangular smears the poles)

The lunar south pole (Artemis) is unreadable on a sphere. Make a flat polar-stereographic image
from the LOLA 80 m polar DEM and overlay HTML pins on it:

```powershell
gdal_translate -of JPEG -ot Byte -scale <min> <max> 0 255 -outsize 2048 2048 data\raw\moon\ldem_80s_80m_float.img moon_south_polar_2k.jpg
```

Pin pixel positions come from polar stereographic math (`scripts/polar_pins.py`):

```python
R, HALF, SIZE = 1737400.0, 304000.0, 2048   # Moon radius, 80°S edge radius (m), image px
r = 2 * R * tan(radians(90 + lat) / 2)
x, y = r * sin(radians(lon)), r * cos(radians(lon))
px, py = (x + HALF) / (2 * HALF) * SIZE, (HALF - y) / (2 * HALF) * SIZE
```

Check this against known features (Malapert peak, Haworth) before you trust it.

---

## 4. The 3D globe (three.js, no build)

Start with a single standalone `prototypes/globe/globe.html`. Fold it into the app afterwards.

### 4.1 Load three.js via import map

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
</script>
```

Pin an exact version (`@0.160.0`), never `@latest`.

### 4.2 Minimal globe

```js
const BODIES = {
  moon:  { color: 'textures/moon_color_4k.jpg',  height: 'textures/moon_height_4k.jpg',  relief: 0.02,  lonOffset: 0 },
  mars:  { color: 'textures/mars_color_4k.jpg',  height: 'textures/mars_height_4k.jpg',  relief: 0.025, lonOffset: 0 },
  earth: { color: 'textures/earth_color_4k.jpg', height: 'textures/earth_height_4k.jpg', relief: 0.015, lonOffset: 0 },
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0B0F17);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(0, 0.6, 3.4);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, minDistance: 1.4, maxDistance: 6, enablePan: false,
                          autoRotate: true, autoRotateSpeed: 0.4 });
controls.addEventListener('start', () => { controls.autoRotate = false; });

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 2, 3); scene.add(sun);

const loader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((res) => loader.load(url, res, undefined, () => res(null)));

const surface = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128),
  new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
scene.add(surface);

async function showBody(key) {
  const cfg = BODIES[key];
  const [color, height] = await Promise.all([loadTex(cfg.color), loadTex(cfg.height)]);
  if (color) color.colorSpace = THREE.SRGBColorSpace;     // colour only, NOT the height map
  const m = surface.material;
  m.map = color; m.displacementMap = height; m.displacementScale = height ? cfg.relief : 0;
  m.needsUpdate = true;
}

// Size from the container, not the window, so two globes side by side work
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}).observe(stage);

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
showBody('moon');
```

### 4.3 Lat/lon ↔ 3D (matches `SphereGeometry` UVs)

```js
function ll2v(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
function v2ll(v) {
  const n = v.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(n.y));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}
```

### 4.4 Pins, picking, fly-to

- Pin = small `SphereGeometry(0.018)` at `ll2v(lat, lon, 1.012)` plus an invisible bigger
  `SphereGeometry(0.055)` hit target (easier clicks), plus a `RingGeometry` halo that does
  `lookAt(pos * 2)` to face outward.
- Picking: `Raycaster.setFromCamera(ndc, camera)` with NDC computed from the **canvas rect**
  (`getBoundingClientRect`), not `innerWidth`, once the globe sits in a panel.
- Treat a pointer as a click only if it moved < 6 px between `pointerdown` and `pointerup`.
  Otherwise every drag-rotate selects something.
- Raycast against `surface` to get the clicked lat/lon (for "pick any spot" scanning) via `v2ll`.
- Fly-to: `flyTarget = ll2v(lat, lon, camera.position.length())`, then `camera.position.lerp(flyTarget, 0.06)` each frame.
- Emit `window.dispatchEvent(new CustomEvent('analog:target', { detail }))` so other panels react.

### 4.5 Calibration checklist

- Pins on Jezero, Gale (Mars), Iceland, Death Valley, Atacama (Earth), Tranquillitatis pit (Moon) sit on the right features?
  If everything is 180° off, set `lonOffset: 180` (texture starts at 0° not −180°) and apply
  `t.wrapS = THREE.RepeatWrapping; t.offset.x = lonOffset / 360` to both textures.
- Relief looks natural? Tune `relief` within 0.015–0.025. Bigger values look fake.
- Missing textures: draw a procedural canvas fallback so the page never breaks.
- Serve over HTTP. `file://` blocks texture loading and `fetch()`.

---

## 5. UI shell

### 5.1 Layout we landed on

```
┌ top bar: title · body switch [Mars|Moon] · layer switch [Photo|Elevation|Slope|Relief] · scale ┐
├──────────── Target body globe ─────────────┬──────────── Earth globe ───────────────┤
│  pins = target sites (click to select)     │  pins = analog candidates, coloured    │
│  globe ⇄ flat map toggle                   │  by score; known analogs vs new picks  │
├──────────── parameter sliders (weights) · presets ─────────────────────────────────┤
└──────────── tabs: Explore | Scan | Dataset ────────────────────────────────────────┘
```

- **Two globes side by side** (target body | Earth). Selecting a target re-scores Earth.
- **Flat map mode**: the same texture as a 2:1 `<div>` with `background-size: 100% 100%` and
  absolutely positioned HTML markers (`left = (lon+180)/360`, `top = (90-lat)/180`). Easier for
  rectangle-drag scan areas than the sphere.
- **Derived layers in the browser**: draw the height JPEG to a canvas, block-average to
  1024×512, compute the gradient (x wraps and is scaled by `cos(lat)`), colour with a ramp, and wrap it in
  `THREE.CanvasTexture` for the globe. Slope is relative (8-bit), so say so in the legend.

### 5.2 Code structure (ES modules, no framework)

```
index.html        markup + CSS tokens + importmap + <script type="module" src="js/main.js">
js/main.js        entry: store, tab routing, wiring
js/explore.js     BODIES, GlobeView class, layers, markers
js/scan.js        drag-a-rectangle scan of Earth
js/dataset.js     labelled dataset table, export
js/scoring.js     pure scoring functions (testable in Node)
js/geo.js         pure geometry: haversine, rect area, lat/lon format
js/store.js       state + localStorage (wrapped in try/catch)
js/sites.js       target + Earth site lists
tests/*.test.mjs  node --test for pure modules
package.json      { "type": "module", "scripts": { "test": "node --test \"tests/*.test.mjs\"" } }
```

Keep pure logic (scoring, geometry, store) DOM-free so `node --test` covers it.

### 5.3 Design tokens (dark space theme)

```css
:root { --bg:#0B0F17; --panel:#0F1520; --line:#1E2635; --line2:#2A3548; --ink:#E6E9EF; --muted:#A3ADBF;
        --good:#3FB950; --ok:#F5A524; --earth:#7CC4FA; --accent:#F78166; }
```

Moon accent `#7CC4FA`, Mars `#F5A524`. Buttons ≥ 44 px tall on touch. Use `aria-pressed` on toggles.

---

## 6. Dev loop

No-cache dev server (`scripts/serve.py`) so edited JS is always picked up:

```python
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ThreadingHTTPServer(("127.0.0.1", port), partial(NoCache, directory=str(ROOT))).serve_forever()
```

```powershell
python scripts/serve.py            # from repo root
# open http://localhost:8765/prototypes/app/
cd prototypes/app; npm test        # pure-module tests
```

Serve from the **repo root** if the app reads textures from `../globe/textures/`.

---

## 7. Terrain metrics pipeline (the science core)

The main lesson from 2026: **compare bodies at the same pixel size.** A sharper DEM always looks
rougher and steeper. That is an artefact, not terrain.

| Scale | Pixel | Window | Earth | Mars | Moon |
| --- | --- | --- | --- | --- | --- |
| landscape | 1850 m | 50 km | ETOPO 2022 (local) | MOLA 463 m | LOLA 16 ppd |
| terrain | 463 m | 50 km | Copernicus GLO-30 (EE) | MOLA 463 m | LOLA 64 ppd |
| rover | 80 m | 20 km | Copernicus GLO-30 (EE) | needs HRSC/CTX DTM | LOLA 80 m polar |

Per site:

1. Reproject a square window to a local **azimuthal equidistant** grid centred on the site
   (`gdalwarp -t_srs "+proj=aeqd +lat_0=.. +lon_0=.. +R=<body radius>"`). Poles then behave like the equator.
   For Mars/Moon, give the source its body CRS (`+R=3396190` Mars, `+R=1737400` Moon).
2. Resample to the scale's pixel size.
3. Metrics: `relief_m` = P98 − P2, `slope_med`/`slope_p90` (deg), `rough_m` = std of (elev − 3×3 mean). Mask the sea on Earth (ETOPO < −150 m). Skip the window if valid cells < 35 %.
4. Similarity: log10 for relief and roughness, z-score each metric over all sites, Euclidean distance (see `moon_vs_earth.py`).

From EE, pull a small Earth window as a numpy array:

```python
from ee_init import init
ee = init()
dem = ee.ImageCollection("COPERNICUS/DEM/GLO30").select("DEM").mosaic()
region = ee.Geometry.Point([lon, lat]).buffer(25_000).bounds()
url = dem.getDownloadURL({"region": region, "scale": 30, "format": "GEO_TIFF", "crs": "EPSG:4326"})
# download url → temp .tif → gdalwarp to aeqd at target pixel size
```

`getDownloadURL` caps requests at about 32 MB / 10k px per side. Keep windows small or raise `scale`.

Output `data/processed/<metrics>.json` and copy it next to the app.

---

## 8. Deploy (Netlify Drop, no account setup)

`scripts/build_netlify.py` copies `index.html`, `js/`, JSON and the six 4k textures into
`dist/netlify-<app>/`, rewrites `'../globe/textures/'` → `'textures/'`, and asserts no `../`
remains. Then:

```powershell
python scripts/build_netlify.py
# drag dist/netlify-<app> onto https://app.netlify.com/drop
```

About 15 MB total with six JPEGs under 3 MB each.

---

## 9. Gotchas we hit

- `ee.Authenticate()` "This app is blocked" → service account (2.4).
- EE "project not registered" → step 2.2.
- `file://` → textures silently fail. Always use HTTP.
- Setting `colorSpace = SRGB` on the height map distorts relief. Use it on colour only.
- three.js sets `canvas.style.display` inline. Hiding it for flat mode needs `display:none !important`.
- Browser cache serves stale ES modules → `serve.py` with `no-store`.
- `localStorage` can throw (private mode). Wrap every access in try/catch.
- `ConvertFrom-Json` on PowerShell 5.1 breaks on GDAL JSON → parse text.
- Moon/Mars poles are smeared on the sphere → polar inset (3.3).
- Earth texture value 0 = ocean. Use `-SeaLevel` or your land mask breaks.

---

## 10. Day-one checklist

- [ ] Tools installed, `gdalinfo` / `gcloud` / `python` / `node` all answer
- [ ] GCP project created, EE API enabled, project registered for non-commercial EE
- [ ] Service account + roles + key in `~/.config/<APP>/`, `python scripts/ee_init.py` OK
- [ ] Raw data downloaded, sources written in `research/sources.md`
- [ ] Six `*_4k.jpg` textures made, each < 3 MB
- [ ] `globe.html` shows all bodies, calibration pins land on the right features
- [ ] App shell with two globes + tabs running via `serve.py`
- [ ] `npm test` green
- [ ] Netlify Drop build works from `dist/`
