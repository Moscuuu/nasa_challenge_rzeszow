// Deterministic mock data generator (contract v0.8). Run: npm run mock-data
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mock-data");
mkdirSync(OUT, { recursive: true });

// --- seeded PRNG (mulberry32) ---
let seed = 20261114;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const wrapLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;

// --- Mars sites (ids/coords exactly as the contract example) ---
const SITES = [
  ["arcadia_planitia", "Arcadia Planitia", -170.0, 42.0, 173.3, 246.6, 0.62, 0.88, 0.45],
  ["deuteronilus_mensae", "Deuteronilus Mensae", 22.5, 44.0, 171.0, 243.9, 0.55, 0.82, 0.4],
  ["phlegra_montes", "Phlegra Montes", 164.0, 40.0, 172.1, 245.0, 0.58, 0.85, 0.42],
  ["erebus_montes", "Erebus Montes", 175.0, 36.0, 170.5, 242.1, 0.5, 0.7, 0.44],
  ["amazonis_posiolova", "Amazonis Planitia (Posiolova crater)", -170.3, 35.1, 174.2, 248.3, 0.48, 0.66, 0.55],
  ["utopia_planitia", "Utopia Planitia", 117.5, 46.7, 172.8, 244.7, 0.6, 0.86, 0.41],
  ["hellas_rim", "Hellas rim", 85.0, -38.0, 176.0, 251.2, 0.3, 0.4, 0.38],
].map(([id, name, lon, lat, tmin, tmax, ice, rank, cl]) => ({ id, name, lon, lat, tmin, tmax, ice, rank, cl }));
// polygons: no SWIM survey (status no_data) for these three sites
const NO_POLY = new Set(["deuteronilus_mensae", "phlegra_montes", "utopia_planitia"]);
for (const s of SITES) {
  s.poly = NO_POLY.has(s.id) ? null : r2(0.5 + rnd() * 0.5);
  s.polyRank = s.poly === null ? null : r2(0.7 + rnd() * 0.29);
}
const SITE_IDS = SITES.map((s) => s.id);
const HELLAS = "hellas_rim";

const marsSites = {
  type: "FeatureCollection",
  mock: true,
  note: "MOCK DATA. Coordinates are approximate placeholders; feature values are invented.",
  features: SITES.map((s) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    properties: {
      id: s.id,
      name: s.name,
      window_deg: 1.0,
      coords_status: "approximate",
      features: {
        temperature: {
          tmin_K: s.tmin,
          tmax_K: s.tmax,
          amp_K: r1(s.tmax - s.tmin),
          summer_tmin_K: r1(s.tmin + 8.7),
          summer_tmax_K: r1(s.tmax + 16.6),
          summer_amp_K: r1(s.tmax - s.tmin + 7.9),
          t_1_5_K: r1(s.tmin + 28),
          t_gt5_K: r1(s.tmin + 27.3),
          unit: "K (surface: mean daily, whole Mars year and local summer; t_1_5 / t_gt5: annual-mean ground temperature at depth)",
          source: "mars_thermal_model",
        },
        ground_ice: {
          "0-1m": { value: s.ice, rank: s.rank },
          "1-5m": { value: r2(s.ice * 0.6), rank: r2(s.rank * 0.5) },
          gt5m: { value: r2(s.ice * 0.3), rank: r2(s.rank * 0.3) },
          unit: "SWIM ice consistency C (-1..1); rank among ice-consistent pixels",
          source: "swim",
        },
        polygons: {
          value: s.poly,
          rank: s.polyRank,
          status: s.poly === null ? "no_data" : "ok",
          unit: "share of SWIM survey images showing HiRISE-scale polygons (0..1); rank among surveyed pixels",
          source: "swim",
        },
      },
      chlorine_wt_pct: s.cl,
      description: "MOCK description of why this site is a candidate.",
      citation: "placeholder",
    },
  })),
};

// --- cell positions over real permafrost regions ---
// [count, lat0, lat1, lon0, lon1, base quality]
const REGIONS = [
  [110, 62, 82, -55, -25, 0.72], // Greenland
  [120, 68, 80, -120, -70, 0.75], // Canadian Arctic
  [60, 77, 80, 11, 25, 0.74], // Svalbard
  [150, 62, 72, 100, 179, 0.7], // Siberia
  [80, 30, 35, 85, 95, 0.68], // Tibet
  [80, -78, -77.2, 160.5, 163, 0.82], // Antarctic Dry Valleys
];
const TOTAL = 600;
const snap = (v) => Math.floor(v * 10) / 10 + 0.05; // cell centres on x.x5
const taken = new Set();
const cells = [];
const addCell = (lat, lon, q, known = null) => {
  lat = r2(snap(clamp(lat, -89.9, 89.9)));
  lon = r2(wrapLon(snap(lon)));
  const key = `${lat}_${lon}`;
  if (taken.has(key)) return false;
  taken.add(key);
  cells.push({ lat, lon, q, known });
  return true;
};
addCell(-77.55, 160.85, 0.93, "McMurdo Dry Valleys");
addCell(75.35, -89.45, 0.9, "Haughton Crater (Devon Island)");
for (const lon of [179.65, 179.85, 179.95, -179.95, -179.75, -179.55]) addCell(68.4 + rnd() * 2, lon, 0.7 + rnd() * 0.1);
for (let i = 0; i < 25; i++) addCell(74.95 + rnd(), -91 + rnd() * 3, clamp(0.86 + gauss() * 0.04, 0.7, 0.93)); // Devon bbox
let goal = cells.length;
for (const [n, la0, la1, lo0, lo1, base] of REGIONS) {
  goal += n;
  for (let guard = 0; cells.length < goal && guard < 50000; guard++) {
    addCell(la0 + rnd() * (la1 - la0), lo0 + rnd() * (lo1 - lo0), clamp(base + gauss() * 0.07, 0.5, 0.92));
  }
}
cells.length = Math.min(cells.length, TOTAL);

// 6 cells where hellas_rim is the best site (not analog, not antimeridian)
const hellasIdx = new Set();
for (let i = 40; hellasIdx.size < 6; i += 97) {
  const c = cells[i % cells.length];
  if (!c.known && Math.abs(c.lon) < 179) hellasIdx.add(i % cells.length);
}

// --- per-site features and scores (site features stay internal; v0.5 files do not carry site_features) ---
const mean = (a) => r2(a.reduce((x, y) => x + y, 0) / a.length);
for (const [idx, c] of cells.entries()) {
  c.sf = {};
  c.site_scores = {};
  let maxOther = 0;
  for (const s of SITES) {
    if (s.id === HELLAS) continue;
    const t = r2(clamp(c.q + gauss() * 0.06, 0.3, 0.97));
    const g = r2(clamp(c.q + gauss() * 0.06, 0.3, 0.97));
    // polygons are skipped (not zeroed) for sites without a SWIM survey
    const p = s.poly === null ? null : r2(clamp(c.q + gauss() * 0.08, 0.2, 0.97));
    const d = r2(clamp(c.q + gauss() * 0.08, 0.2, 0.97));
    c.sf[s.id] = { temperature: t, ground_ice: g, polygons: p, dryness: d };
    c.site_scores[s.id] = mean([t, g, d, ...(p === null ? [] : [p])]);
    maxOther = Math.max(maxOther, c.site_scores[s.id]);
  }
  if (hellasIdx.has(idx)) {
    const t = r2(Math.min(0.99, maxOther + 0.03)); // hellas wins here
    c.sf[HELLAS] = { temperature: t, ground_ice: t, polygons: t, dryness: t };
    c.site_scores[HELLAS] = t;
  } else {
    c.sf[HELLAS] = { temperature: null, ground_ice: null, polygons: null, dryness: null };
    c.site_scores[HELLAS] = null;
  }
  c.best = SITE_IDS.filter((id) => c.site_scores[id] !== null).reduce((a, b) => (c.site_scores[b] > c.site_scores[a] ? b : a));
  c.score = c.site_scores[c.best];
  c.tied = SITE_IDS.filter((id) => c.site_scores[id] !== null && Math.abs(c.site_scores[id] - c.score) <= 0.001);
  const bf = c.sf[c.best];
  const ok = ["temperature", "ground_ice", "polygons", "dryness"].filter((k) => bf[k] !== null);
  c.strengths = ok.filter((k) => bf[k] >= 0.85);
  c.breaks_down = ok.filter((k) => bf[k] < 0.55);
}

cells.sort((a, b) => b.score - a.score || a.lat - b.lat || a.lon - b.lon);
cells.forEach((c, i) => {
  c.rank = i + 1;
  c.percentile = r2(99.99 - i * 0.01);
});

const PLACES = ["Verkhoyansk Range, Russia", "Peary Land, Greenland", null, "Brooks Range, United States", "Taymyr Peninsula, Russia"];
const HOURS = [0, 1, 2, 3, 13, 14];
const cellFeatures = cells.map((c, idx) => {
  const bf = c.sf[c.best];
  const ms = SITES.find((s) => s.id === c.best);
  const tmin = r2(225 + rnd() * 20);
  const amp = r1(18 + rnd() * 14);
  const sTmin = r2(tmin + 10 + rnd() * 5);
  const sAmp = r1(amp + 1 + rnd() * 3);
  const win = {};
  for (const s of SITES) {
    win[s.id] =
      c.site_scores[s.id] === null
        ? null
        : { months: [6, 7, 8], hours_local: HOURS, hours_per_year: Math.round(150 + c.site_scores[s.id] * 300), mars_range_K: [s.tmin, s.tmax] };
  }
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    properties: {
      id: `c_${c.lat}_${c.lon}`,
      rank: c.rank,
      percentile: c.percentile,
      score: c.score,
      best_site_id: c.best,
      tied_site_ids: c.tied,
      site_scores: c.site_scores,
      features: {
        temperature: {
          score: bf.temperature,
          parts: {
            tmin: r2(clamp(bf.temperature + 0.02, 0, 1)),
            tmax: r2(clamp(bf.temperature - 0.02, 0, 1)),
            amp: r2(clamp(bf.temperature - 0.05, 0, 1)),
            summer_tmin: r2(clamp(bf.temperature + 0.03, 0, 1)),
            summer_tmax: r2(clamp(bf.temperature, 0, 1)),
            summer_amp: r2(clamp(bf.temperature - 0.08, 0, 1)),
          },
          earth_value: { tmin_K: tmin, tmax_K: r2(tmin + amp), amp_K: amp, summer_tmin_K: sTmin, summer_tmax_K: r2(sTmin + sAmp), summer_amp_K: sAmp },
          mars_value: {
            tmin_K: ms.tmin,
            tmax_K: ms.tmax,
            amp_K: r1(ms.tmax - ms.tmin),
            summer_tmin_K: r1(ms.tmin + 8.7),
            summer_tmax_K: r1(ms.tmax + 16.6),
            summer_amp_K: r1(ms.tmax - ms.tmin + 7.9),
          },
          unit: "K (surface skin temperature, mean daily; whole year and local summer)",
          status: "ok",
          source: "era5_land",
        },
        ground_ice: {
          score: bf.ground_ice,
          earth_value: {
            shallow_ice_certainty: r2(clamp(c.q - 0.1 + rnd() * 0.2, 0.2, 1)),
            active_layer_m: r2(0.03 + rnd() * 0.4),
            permafrost_fraction: r2(0.8 + rnd() * 0.2),
          },
          mars_value: { swim_c: ms.ice },
          unit: "compared by percentile on each planet",
          status: "ok",
          source: "esa_cci_permafrost",
        },
        polygons: {
          score: bf.polygons,
          earth_value: { cracking_potential: r2(clamp(c.q + gauss() * 0.1, 0, 1)), ground_surface_temp_K: r2(tmin + 3) },
          mars_value: { swim_polygon_share: ms.poly },
          unit: "compared by percentile on each planet; Earth value estimated from ground temperature, not observed",
          status: bf.polygons === null ? "no_data" : "ok",
          source: "esa_cci_permafrost+swim",
        },
        dryness: {
          score: bf.dryness,
          parts: { wet_summer: r2(bf.dryness), precip_mm_yr: r2(clamp(bf.dryness - 0.03, 0, 1)) },
          earth_value: { wet_summer: r2(0.05 + rnd() * 0.2), precip_mm_yr: r1(100 + rnd() * 250) },
          mars_value: { wet_summer: 0, precip_mm_yr: 0 },
          unit: "wet_summer: surface soil wetness 0-5 cm, local summer (fraction of saturation); precip: mm/yr; ranked driest = 1",
          status: "ok",
          source: "smap_l4",
        },
      },
      strengths: c.strengths,
      breaks_down: c.breaks_down,
      known_analog: c.known,
      place: PLACES[idx % PLACES.length],
      experiment_window: idx % 7 === 3 ? null : win,
    },
  };
});

writeFileSync(
  join(OUT, "cells_top_0-1m.geojson"),
  `{"type":"FeatureCollection","mock":true,"layer":"0-1m","note":"MOCK DATA. Shape is real, numbers are invented.","features":[\n` +
    cellFeatures.map((f) => JSON.stringify(f)).join(",\n") +
    "\n]}\n",
);
writeFileSync(join(OUT, "mars_sites.geojson"), JSON.stringify(marsSites, null, 1));

// --- validation ---
const inBox = (c, b) => c.lon >= b[0] && c.lon <= b[2] && c.lat >= b[1] && c.lat <= b[3];
const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
// bbox is only used here to pick cells; v0.5 validation files carry no bbox
const mkCheck = (name, role, n, bbox, fallback) => {
  const median_percentile = median(cells.filter((c) => inBox(c, bbox)).map((c) => c.percentile)) ?? fallback;
  return { name, role, cells: n, median_percentile, passed: role === "known_analog" ? median_percentile >= 90 : median_percentile < 50, applicable: true };
};
writeFileSync(
  join(OUT, "validation_0-1m.json"),
  JSON.stringify(
    {
      mock: true,
      layer: "0-1m",
      checks: [
        mkCheck("McMurdo Dry Valleys", "known_analog", 250, [160.5, -78.0, 163.0, -77.2], 99.1),
        mkCheck("Haughton Crater (Devon Island)", "known_analog", 330, [-91.0, 74.9, -88.0, 76.0], 93.0),
        mkCheck("Alaska North Slope", "contrast", 9000, [-160.0, 69.0, -145.0, 71.0], 41.0),
      ],
      weights: { temperature: 0.25, ground_ice: 0.25, polygons: 0.25, dryness: 0.25 },
      notes: "MOCK. Equal weights over the features available for a Mars site. Percentile = position of the cell's best score among all permafrost cells.",
    },
    null,
    1,
  ),
);

// --- manifest ---
const scoreMaps = { best: "score_0-1m_best.png" };
for (const id of SITE_IDS) scoreMaps[id] = `score_0-1m_${id}.png`;
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      contract_version: "0.8",
      generated_at: "2026-11-14T22:00:00Z",
      mock: true,
      cell_size_deg: 0.1,
      layers: [
        { id: "0-1m", label: "0–1 m (dig-able ice)", available: true },
        { id: "1-5m", label: "1–5 m (shallow drilling)", available: false },
        { id: "gt5m", label: "> 5 m (deep resources)", available: false },
      ],
      features: [
        { id: "temperature", label: "Temperature", comparison: "rank" },
        { id: "ground_ice", label: "Ground ice", comparison: "position" },
        { id: "polygons", label: "Thermal-contraction polygons", comparison: "position" },
        { id: "dryness", label: "Dryness (dry permafrost vs wet tundra)", comparison: "rank" },
      ],
      sites: SITE_IDS,
      files: { mars_sites: "mars_sites.geojson", cells_top: { "0-1m": "cells_top_0-1m.geojson" }, score_maps: { "0-1m": scoreMaps }, validation: { "0-1m": "validation_0-1m.json" } },
      sources: [
        { id: "era5_land", label: "ERA5-Land hourly / daily aggregates (ECMWF, via Google Earth Engine), 2023", url: "https://doi.org/10.24381/cds.e2161bac" },
        { id: "esa_cci_permafrost", label: "ESA Permafrost CCI v5.0 (PFR, ALT), 2023", url: "https://climate.esa.int/en/projects/permafrost/" },
        { id: "swim", label: "SWIM4MIM ice consistency composites (PSI / NASA)", url: "https://swim.psi.edu" },
        { id: "mars_thermal_model", label: "Team 1-D Mars surface thermal model (A=0.25, I=250)", url: null },
      ],
    },
    null,
    1,
  ),
);

// --- score PNGs: 3600x1800 equirectangular, smooth blobs around cells, alpha 0 outside ---
const W = 3600, H = 1800, PPD = 10, SIGMA = 25, R = 75;
const kernel = [];
for (let d = -R; d <= R; d++) kernel.push(Math.exp(-(d * d) / (2 * SIGMA * SIGMA)));
function writePng(file, getScore) {
  const num = new Float32Array(W * H), den = new Float32Array(W * H);
  for (const c of cells) {
    const s = getScore(c);
    if (s === null) continue;
    const cx = Math.round((c.lon + 180) * PPD), cy = Math.round((90 - c.lat) * PPD);
    for (let dy = -R; dy <= R; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const x = (((cx + dx) % W) + W) % W; // wrap across the antimeridian
        const w = kernel[dy + R] * kernel[dx + R];
        num[y * W + x] += w * s;
        den[y * W + x] += w;
      }
    }
  }
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (den[i] < 0.25) continue; // stays transparent (zero-filled)
    const v = Math.round(clamp(num[i] / den[i], 0, 1) * 255);
    png.data[o] = png.data[o + 1] = png.data[o + 2] = v;
    png.data[o + 3] = 255;
  }
  writeFileSync(join(OUT, file), PNG.sync.write(png, { deflateLevel: 9 }));
}
writePng("score_0-1m_best.png", (c) => c.score);
for (const id of SITE_IDS) writePng(`score_0-1m_${id}.png`, (c) => c.site_scores[id]);
console.log(`mock data written: ${cells.length} cells -> ${OUT}`);
