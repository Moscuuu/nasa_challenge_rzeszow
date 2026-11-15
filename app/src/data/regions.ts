import { distDeg, topForSite } from "./cells";
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

/** How many top analogs are shown, and how close (deg) two must be to share a region. */
export const ANALOG_COUNT = 30;
export const JOIN_DEG = 6;
const MARGIN_DEG = 1.2;

const rad = Math.PI / 180;

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
 * Top analogs for a site, grouped into regions: single-linkage on distance (a point joins every
 * region it is within JOIN_DEG of, merging them). Regions are ranked by their best analog.
 */
export function analogRegions(cells: Cell[], siteId: string | null, n = ANALOG_COUNT, joinDeg = JOIN_DEG): AnalogRegion[] {
  const top = topForSite(cells, siteId, n, 0); // raw top cells: the grouping into regions happens here
  const score = (c: Cell) => (siteId === null ? c.score : c.site_scores[siteId] ?? 0);
  const points: AnalogPoint[] = top.map((cell, i) => ({ cell, rank: i + 1, score: score(cell) }));

  let groups: AnalogPoint[][] = [];
  for (const p of points) {
    const near = groups.filter((g) => g.some((q) => distDeg(p.cell.lat, p.cell.lon, q.cell.lat, q.cell.lon) <= joinDeg));
    const merged = [p, ...near.flat()];
    groups = groups.filter((g) => !near.includes(g));
    groups.push(merged);
  }

  return groups
    .map((g) => g.sort((a, b) => a.rank - b.rank))
    .sort((a, b) => a[0].rank - b[0].rank)
    .map((g, i) => {
      // Centre: mean of unit vectors (safe across the dateline).
      let x = 0, y = 0, z = 0;
      for (const p of g) {
        const la = p.cell.lat * rad, lo = p.cell.lon * rad;
        x += Math.cos(la) * Math.cos(lo);
        y += Math.cos(la) * Math.sin(lo);
        z += Math.sin(la);
      }
      const lat = Math.atan2(z, Math.hypot(x, y)) / rad;
      const lon = Math.atan2(y, x) / rad;
      const radiusDeg = Math.max(...g.map((p) => distDeg(lat, lon, p.cell.lat, p.cell.lon))) + MARGIN_DEG;
      return {
        id: `r${i + 1}_${g[0].cell.id}`,
        rank: i + 1,
        name: regionName(g, lat, lon),
        lat,
        lon,
        radiusDeg,
        best: g[0].score,
        points: g,
      };
    });
}
