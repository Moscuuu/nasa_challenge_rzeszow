import { describe, expect, it } from "vitest";
import type { Cell, CellFeature } from "./types";
import { featuresFor, formatCoords, nearestTopCell, placeLabel, topForSite } from "./cells";

const feat = (score: number | null, status: CellFeature["status"] = "ok"): CellFeature => ({
  score, earth_value: null, mars_value: null, unit: null, status, source: null,
});
const mk = (id: string, o: Partial<Cell> = {}): Cell => ({
  id, lat: 0, lon: 0, rank: 1, percentile: 99, score: 0.5,
  best_site_id: "a", tied_site_ids: ["a"], site_scores: { a: 0.5 },
  features: { temperature: feat(0.8), ground_ice: feat(null, "no_data"), polygons: feat(0.4) },
  strengths: ["temperature"], breaks_down: [], known_analog: null, place: null,
  experiment_window: null, ...o,
});

describe("topForSite", () => {
  it("excludes null site scores and sorts desc", () => {
    const cells = [
      ...Array.from({ length: 6 }, (_, i) => mk(`h${i}`, { site_scores: { hellas_rim: 0.1 * (i + 1) } })),
      ...Array.from({ length: 4 }, (_, i) => mk(`n${i}`, { site_scores: { hellas_rim: null } })),
    ];
    const r = topForSite(cells, "hellas_rim");
    expect(r).toHaveLength(6);
    expect(r[0].id).toBe("h5");
  });
  it("null site uses score, caps at n", () => {
    const cells = [mk("a", { score: 0.2 }), mk("b", { score: 0.9 }), mk("c", { score: 0.5 })];
    expect(topForSite(cells, null, 2).map((c) => c.id)).toEqual(["b", "c"]);
  });
});

describe("nearestTopCell", () => {
  it("wraps across the antimeridian", () => {
    const c = mk("x", { lat: -40, lon: 179.95 });
    expect(nearestTopCell([c], -40, -179.98)?.id).toBe("x");
  });
  it("returns null outside radius", () => {
    expect(nearestTopCell([mk("x", { lat: 10, lon: 10 })], 10, 11)).toBeNull();
  });
  it("picks the closest", () => {
    const a = mk("a", { lat: 0, lon: 0.1 }), b = mk("b", { lat: 0, lon: 0.02 });
    expect(nearestTopCell([a, b], 0, 0)?.id).toBe("b");
  });
});

describe("featuresFor", () => {
  it("falls back to features, sets vsSiteId, keeps null status", () => {
    const f = featuresFor(mk("x"), "other");
    expect(f.vsSiteId).toBe("a");
    const ice = f.rows.find((r) => r.id === "ground_ice")!;
    expect(ice.score).toBeNull();
    expect(ice.status).toBe("no_data");
    expect(f.featureCount).toEqual({ ok: 2, total: 3 });
    expect(f.tiedSiteIds).toEqual(["a"]);
  });
  it("no vsSiteId for best site or null site", () => {
    expect(featuresFor(mk("x"), "a").vsSiteId).toBeNull();
    expect(featuresFor(mk("x"), null).vsSiteId).toBeNull();
  });
  it("uses site_features when present", () => {
    const c = mk("x", {
      site_features: { other: { temperature: 0.1, ground_ice: 0.2, strengths: ["ground_ice"], breaks_down: ["temperature"] } },
    });
    const f = featuresFor(c, "other");
    expect(f.vsSiteId).toBeNull();
    expect(f.strengths).toEqual(["ground_ice"]);
    expect(f.breaks).toEqual(["temperature"]);
    expect(f.rows.find((r) => r.id === "temperature")!.score).toBe(0.1);
  });
  it("excludes not_relevant from total", () => {
    const c = mk("x", { features: { temperature: feat(0.8), ground_ice: feat(null, "not_relevant"), polygons: feat(0.4) } });
    expect(featuresFor(c, null).featureCount).toEqual({ ok: 2, total: 2 });
  });
});

describe("labels", () => {
  it("formats coords", () => {
    expect(formatCoords(-77.55, 160.85)).toBe("77.55°S 160.85°E");
    expect(formatCoords(10, -5.5)).toBe("10.00°N 5.50°W");
  });
  it("placeLabel falls back to coords", () => {
    expect(placeLabel(mk("x", { lat: -77.55, lon: 160.85 }))).toBe("77.55°S 160.85°E");
    expect(placeLabel(mk("x", { place: "Hellas" }))).toBe("Hellas");
  });
});
