import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Manifest } from "./types";

const out = join(process.cwd(), "..", "out");
const have = existsSync(join(out, "manifest.json"));
const readJson = (f: string) => JSON.parse(readFileSync(join(out, f), "utf8"));

describe.skipIf(!have)("real data in ../out satisfies the v0.8 type assumptions", () => {
  const manifest = (have ? readJson("manifest.json") : null) as Manifest;

  it("manifest has per-layer files", () => {
    expect(manifest.contract_version).toBe("0.8");
    expect(manifest.sites).toHaveLength(7);
    for (const l of manifest.layers.filter((l) => l.available)) {
      expect(typeof manifest.files.validation[l.id]).toBe("string");
      expect(typeof manifest.files.cells_top[l.id]).toBe("string");
      expect(manifest.files.score_maps[l.id]).toBeTruthy();
    }
  });

  it("every layer's cells have the assumed keys", () => {
    for (const l of manifest.layers.filter((l) => l.available)) {
      const cells = readJson(manifest.files.cells_top[l.id]!).features;
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells.slice(0, 300)) {
        const p = c.properties;
        expect(Object.keys(p.site_scores).sort()).toEqual([...manifest.sites].sort());
        expect(Array.isArray(p.tied_site_ids)).toBe(true);
        expect(p.tied_site_ids).toContain(p.best_site_id);
        expect(typeof p.features.temperature.parts).toBe("object");
        expect(["ok", "no_data", "no_data_penalized", "not_relevant", "pending"]).toContain(p.features.dryness.status);
        // dryness counts only in 0-1 m
        expect(p.features.dryness.status === "not_relevant").toBe(l.id !== "0-1m");
        expect(["ok", "no_data", "no_data_penalized", "not_relevant", "pending"]).toContain(p.features.polygons.status);
        expect(c.geometry.coordinates).toHaveLength(2);
      }
    }
  });

  it("manifest lists 4 features incl. dryness; polygons compared by position", () => {
    expect(manifest.features.map((f) => f.id)).toEqual(["temperature", "ground_ice", "polygons", "dryness"]);
    expect(manifest.features.find((f) => f.id === "polygons")!.comparison).toBe("position");
  });

  it("validation files parse per layer; bbox optional", () => {
    for (const [layer, file] of Object.entries(manifest.files.validation)) {
      const v = readJson(file!);
      expect(v.layer).toBe(layer);
      expect(v.checks.length).toBeGreaterThan(0);
    }
  });

  it("mars_sites has per-layer ground_ice and polygons block", () => {
    const sites = readJson("mars_sites.geojson").features;
    expect(sites).toHaveLength(7);
    for (const s of sites) {
      expect(s.properties.features.ground_ice["0-1m"]).toBeTruthy();
      expect(s.properties.features.polygons).toHaveProperty("status");
    }
  });
});
