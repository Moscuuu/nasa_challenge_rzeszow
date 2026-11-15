import { describe, expect, it } from "vitest";
import { analogRegions } from "./regions";
import { topForSite } from "./cells";
import type { Cell } from "./types";

const cell = (id: string, lat: number, lon: number, score: number, place: string | null = null): Cell =>
  ({ id, lat, lon, score, place, site_scores: { s: score } }) as unknown as Cell;

describe("analogRegions", () => {
  const cells = [
    cell("a1", -27, -68.8, 0.96, "Andes, Argentina"),
    cell("g1", 81.8, -32, 0.95, "Greenland"),
    cell("a2", -29, -69.8, 0.94, "Andes, Argentina"),
    cell("a3", -26.9, -68.7, 0.93, "Altiplano, Chile"),
    cell("x1", -78, 164, 0.92),
  ];

  it("groups nearby analogs, ranks regions by their best analog, keeps overall point ranks", () => {
    const r = analogRegions(cells, "s");
    expect(r.map((x) => x.name)).toEqual(["Andes, Argentina", "Greenland", "Antarctica"]);
    expect(r[0].points.map((p) => p.rank)).toEqual([1, 3, 4]);
    expect(r[0].radiusDeg).toBeGreaterThan(1.2);
  });

  it("puts each region pin on the same best cell as the match list (camera focus and pulse)", () => {
    const r = analogRegions(cells, "s");
    expect(r.map((x) => [x.lat, x.lon])).toEqual(topForSite(cells, "s").map((c) => [c.lat, c.lon]));
    expect(r.map((x) => x.points[0].cell.id)).toEqual(topForSite(cells, "s").map((c) => c.id));
  });

  it("hides points below 90 % similarity but keeps a region's best point", () => {
    const weak = [cell("w1", 10, 10, 0.85), cell("w2", 10.5, 10, 0.8), cell("s1", 50, 50, 0.95), cell("s2", 50.5, 50, 0.7)];
    const r = analogRegions(weak, "s");
    expect(r.map((x) => x.points.map((p) => p.cell.id))).toEqual([["s1"], ["w1"]]);
  });

  it("merges chains of points across the join distance and handles the dateline", () => {
    const r = analogRegions([cell("e", 70, 179, 0.9), cell("w", 70, -179, 0.8)], "s");
    expect(r).toHaveLength(1);
    expect(Math.abs(r[0].lon)).toBeGreaterThan(178);
  });
});
