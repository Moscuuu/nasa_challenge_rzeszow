import { distDeg, REGION_RADIUS_KM, topForSite } from "./cells";
import type { Cell } from "./types";

export interface AnalogPoint {
  cell: Cell;
  /** 1-based rank among all analogs for the site. */
  rank: number;
  score: number;
}

export interface AnalogRegion {
  id: string;
  /** 1-based, by the region's best analog. */
  rank: number;
  name: string;
  lat: number;
  lon: number;
  /** Angular radius (deg) that covers every point, with a small margin. */
  radiusDeg: number;
  best: number;
  points: AnalogPoint[];
}

/** At most this many analog points are shown inside one region (zoomed in). */
export const POINTS_PER_REGION = 30;
/** Point pins below this similarity (as shown, in %) are hidden; a region always keeps its best point. */
export const MIN_POINT_PCT = 90;
const MARGIN_DEG = 1.2;
const KM_PER_DEG = 111.195;


function fallbackName(lat: number, lon: number): string {
  if (lat < -60) return "Antarctica";
  const ns = `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(lon).toFixed(0)}°${lon >= 0 ? "E" : "W"}`;
  return `${ns} ${ew}`;
}

/** Most common place name among the points (ties: the better-ranked point's name). */
function regionName(points: AnalogPoint[], lat: number, lon: number): string {
  const counts = new Map<string, number>();
  for (const p of points) if (p.cell.place) counts.set(p.cell.place, (counts.get(p.cell.place) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return best ?? fallbackName(lat, lon);
}

/**
 * The site's analog regions: the same regions, in the same order, as the match list (topForSite: the best
 * cell, then the next best cell farther than radiusKm from every region already listed). A region's pin
 * sits on its best cell, so pin, camera focus and pulse coincide. Its points are the best-ranked cells
 * within radiusKm of it (nearest region wins), with their overall rank for the site, keeping only those
 * shown as >= minPct % similar; if none is, the region keeps its best point alone.
 */
export function analogRegions(
  cells: Cell[],
  siteId: string | null,
  n = 10,
  radiusKm = REGION_RADIUS_KM,
  perRegion = POINTS_PER_REGION,
  minPct = MIN_POINT_PCT,
): AnalogRegion[] {
  const val = (c: Cell): number | null => (siteId === null ? c.score : c.site_scores[siteId] ?? null);
  const ranked = cells
    .map((cell) => ({ cell, score: val(cell) }))
    .filter((x): x is { cell: Cell; score: number } => x.score !== null && x.score !== undefined)
    .sort((a, b) => b.score - a.score)
    .map((x, i): AnalogPoint => ({ ...x, rank: i + 1 }));
  const heads = topForSite(cells, siteId, n, radiusKm);
  const groups: AnalogPoint[][] = heads.map(() => []);
  const radiusDeg = radiusKm / KM_PER_DEG;
  for (const p of ranked) {
    let best = -1;
    let bestD = Infinity;
    heads.forEach((h, i) => {
      const d = distDeg(p.cell.lat, p.cell.lon, h.lat, h.lon);
      if (d <= radiusDeg && d < bestD) [best, bestD] = [i, d];
    });
    if (best >= 0 && groups[best].length < perRegion) groups[best].push(p);
  }

  return heads.map((h, i) => {
    const strong = groups[i].filter((p) => Math.round(p.score * 100) >= minPct);
    const g = strong.length > 0 ? strong : groups[i].slice(0, 1);
    const radius = Math.max(0, ...g.map((p) => distDeg(h.lat, h.lon, p.cell.lat, p.cell.lon))) + MARGIN_DEG;
    return {
      id: `r${i + 1}_${h.id}`,
      rank: i + 1,
      name: regionName(g, h.lat, h.lon),
      lat: h.lat,
      lon: h.lon,
      radiusDeg: radius,
      best: g[0]?.score ?? val(h) ?? 0,
      points: g,
    };
  });
}
