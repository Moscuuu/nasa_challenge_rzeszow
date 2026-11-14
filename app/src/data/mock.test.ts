import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import type { Manifest } from "./types";

const dir = join(process.cwd(), "public", "mock-data");
const readJson = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

describe("mock data (contract v0.5)", () => {
  const manifest = readJson("manifest.json") as Manifest;
  const cells = readJson("cells_top_0-1m.geojson").features;

  it("manifest is v0.5 with 7 sites; only 0-1m available", () => {
    expect(manifest.contract_version).toBe("0.5");
    expect(manifest.layers.map((l) => l.available)).toEqual([true, false, false]);
    expect(manifest.mock).toBe(true);
    expect(manifest.sites).toHaveLength(7);
    expect(readJson("mars_sites.geojson").features).toHaveLength(7);
  });

  it("every cell has site_scores keyed by exactly manifest.sites and tied_site_ids", () => {
    expect(cells.length).toBeGreaterThan(500);
    for (const c of cells) {
      expect(Object.keys(c.properties.site_scores).sort()).toEqual([...manifest.sites].sort());
      expect(c.properties.tied_site_ids).toContain(c.properties.best_site_id);
      expect(typeof c.properties.features.temperature.parts).toBe("object");
    }
  });

  it("hellas_rim is best in exactly 6 cells and scored only there", () => {
    const best = cells.filter((c: any) => c.properties.best_site_id === "hellas_rim");
    const scored = cells.filter((c: any) => c.properties.site_scores.hellas_rim !== null);
    expect(best).toHaveLength(6);
    expect(scored).toHaveLength(6);
  });

  it("has cells near the antimeridian", () => {
    const near = cells.filter((c: any) => Math.abs(c.geometry.coordinates[0]) > 179);
    expect(near.length).toBeGreaterThanOrEqual(3);
  });

  it("validation is per layer and needs no bbox", () => {
    expect(manifest.files.validation).toEqual({ "0-1m": "validation_0-1m.json" });
    const v = readJson(manifest.files.validation["0-1m"]!);
    expect(v.layer).toBe("0-1m");
    expect(v.checks.length).toBeGreaterThan(0);
  });

  it("best score map decodes to 3600x1800", () => {
    const png = PNG.sync.read(readFileSync(join(dir, "score_0-1m_best.png")));
    expect([png.width, png.height]).toEqual([3600, 1800]);
  });
});
