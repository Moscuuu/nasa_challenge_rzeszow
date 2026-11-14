import type { Cell, FeatureId, FeatureStatus } from "./types";

export interface FeatureRow {
  id: FeatureId;
  score: number | null;
  status: FeatureStatus;
}

export interface CardFeatures {
  rows: FeatureRow[];
  strengths: FeatureId[];
  breaks: FeatureId[];
  /** site the shown features are relative to when it differs from the selected one */
  vsSiteId: string | null;
  /** ok features vs. total (not_relevant excluded) */
  featureCount: { ok: number; total: number };
  tiedSiteIds: string[];
}

const FEATURE_IDS: FeatureId[] = ["temperature", "ground_ice", "polygons"];

export function topForSite(cells: Cell[], siteId: string | null, n = 10): Cell[] {
  const val = (c: Cell): number | null => (siteId === null ? c.score : c.site_scores[siteId] ?? null);
  return cells
    .map((c) => ({ c, v: val(c) }))
    .filter((x): x is { c: Cell; v: number } => x.v !== null && x.v !== undefined)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => x.c);
}

const rad = Math.PI / 180;
function distDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / rad;
}

export function nearestTopCell(cells: Cell[], lat: number, lon: number, radiusDeg = 0.15): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const d = distDeg(lat, lon, c.lat, c.lon);
    if (d <= radiusDeg && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function featuresFor(cell: Cell, siteId: string | null): CardFeatures {
  const sf = siteId !== null ? cell.site_features?.[siteId] : undefined;
  const rows: FeatureRow[] = FEATURE_IDS.filter((id) => cell.features[id]).map((id) => {
    const f = cell.features[id];
    let score = f.score;
    if (sf && id !== "polygons") score = sf[id];
    return { id, score, status: f.status };
  });
  const ok = rows.filter((r) => r.status === "ok").length;
  const total = rows.filter((r) => r.status !== "not_relevant").length;
  return {
    rows,
    strengths: sf ? sf.strengths : cell.strengths,
    breaks: sf ? sf.breaks_down : cell.breaks_down,
    vsSiteId: !sf && siteId !== null && siteId !== cell.best_site_id ? cell.best_site_id : null,
    featureCount: { ok, total },
    tiedSiteIds: cell.tied_site_ids ?? [],
  };
}

export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`;
}

export function placeLabel(cell: Cell): string {
  return cell.place ?? formatCoords(cell.lat, cell.lon);
}
