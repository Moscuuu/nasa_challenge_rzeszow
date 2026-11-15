import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createDataSource } from "../data/source";
import { topForSite } from "../data/cells";
import { currentCell, createAppStore } from "./store";
import type { ValidationCheck } from "../data/types";

const dir = join(process.cwd(), "public", "mock-data");

function makeDs() {
  const fetched: string[] = [];
  const fetchImpl = (async (url: string) => {
    fetched.push(url);
    const body = readFileSync(join(dir, url.replace(/^.*mock-data\//, "")), "utf8");
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
  const decode = async (url: string) => {
    fetched.push(url);
    const png = PNG.sync.read(readFileSync(join(dir, url.replace(/^.*mock-data\//, ""))));
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  };
  return { ds: createDataSource("/mock-data/", fetchImpl, decode), fetched };
}

async function freshStore() {
  const { ds, fetched } = makeDs();
  const store = createAppStore();
  await store.getState().init(ds);
  return { store, fetched };
}

describe("app store", () => {
  it("init: no site selected, current cell is global #1", async () => {
    const { store } = await freshStore();
    const s = store.getState();
    expect(s.siteId).toBeNull();
    expect(s.layer).toBe("0-1m");
    expect(s.sites).toHaveLength(7);
    expect(s.checks.length).toBeGreaterThan(0);
    expect(s.index).toBe(0);
    const top = [...s.cells].sort((a, b) => b.score - a.score)[0];
    expect(currentCell(s)?.id).toBe(top.id);
  });

  it("stage: pick -> depth on a site pick -> explore on an available depth; the card opens only on an Earth click", async () => {
    const { store } = await freshStore();
    expect(store.getState().stage).toBe("pick");
    expect(store.getState().cardOpen).toBe(false);
    await store.getState().selectSite("hellas_rim");
    expect(store.getState().stage).toBe("depth");
    const layers = store.getState().manifest!.layers;
    const soon = layers.find((l) => !l.available);
    if (soon) {
      await store.getState().selectLayer(soon.id);
      expect(store.getState().stage).toBe("depth"); // an unavailable depth does not advance
    }
    const pending = store.getState().selectLayer(layers.find((l) => l.available)!.id);
    expect(store.getState().stage).toBe("explore"); // synchronous: the layout move starts on the click
    await pending;
    expect(store.getState().cardOpen).toBe(false);
    store.getState().step(1);
    expect(store.getState().cardOpen).toBe(false);
    const c = store.getState().list[0];
    store.getState().clickEarth(c.lat, c.lon);
    expect(store.getState().cardOpen).toBe(true);
    store.getState().step(1);
    expect(store.getState().cardOpen).toBe(true); // browsing keeps it open
    await store.getState().selectSite(null);
    expect(store.getState().stage).toBe("explore");
    expect(store.getState().cardOpen).toBe(false); // new matches: wait for the next click
  });

  it("selectSite hellas_rim: 6 cells, stepping wraps, focus follows", async () => {
    const { store } = await freshStore();
    await store.getState().selectSite("hellas_rim");
    expect(store.getState().list).toHaveLength(6);
    expect(store.getState().focus).toEqual({ lat: store.getState().list[0].lat, lon: store.getState().list[0].lon });
    for (let i = 0; i < 6; i++) store.getState().step(1);
    expect(store.getState().index).toBe(0);
    store.getState().step(-1);
    expect(store.getState().index).toBe(5);
    const c = store.getState().list[5];
    expect(store.getState().focus).toEqual({ lat: c.lat, lon: c.lon });
  });

  it("selectLayer on an unavailable layer sets layerPending without fetching", async () => {
    const { store, fetched } = await freshStore();
    const before = fetched.length;
    await store.getState().selectLayer("1-5m");
    expect(store.getState().layerPending).toBe(true);
    expect(store.getState().layer).toBe("0-1m");
    expect(fetched.length).toBe(before);
    await store.getState().selectLayer("0-1m");
    expect(store.getState().layerPending).toBe(false);
    expect(store.getState().index).toBe(0);
  });

  it("clickEarth: ocean none, far permafrost pixel score, near cell cell", async () => {
    const { store } = await freshStore();
    const s = store.getState();
    store.getState().clickEarth(0, -30);
    expect(store.getState().earthHit).toEqual({ kind: "none", lat: 0, lon: -30 });
    const map = s.scoreMap!;
    let pt: { lat: number; lon: number } | null = null;
    for (let y = 0; y < map.height && !pt; y += 7)
      for (let x = 0; x < map.width && !pt; x += 7) {
        const lat = 90 - ((y + 0.5) / map.height) * 180;
        const lon = -180 + ((x + 0.5) / map.width) * 360;
        if (map.sample(lat, lon) !== null && s.cells.every((c) => Math.abs(c.lat - lat) > 2 || Math.abs(c.lon - lon) > 2))
          pt = { lat, lon };
      }
    expect(pt).not.toBeNull();
    store.getState().clickEarth(pt!.lat, pt!.lon);
    const hit = store.getState().earthHit;
    expect(hit?.kind).toBe("score");
    const cell = s.cells[0];
    store.getState().clickEarth(cell.lat, cell.lon);
    const h2 = store.getState().earthHit;
    expect(h2?.kind).toBe("cell");
    expect(currentCell(store.getState())?.id).toBe(h2?.kind === "cell" ? h2.cell.id : "");
  });

  it("selectSite clears earthHit", async () => {
    const { store } = await freshStore();
    store.getState().clickEarth(0, -30);
    await store.getState().selectSite("hellas_rim");
    expect(store.getState().earthHit).toBeNull();
  });

  it("focusCheck uses check.bbox, falling back to CHECK_BOXES; openValidation toggles", async () => {
    const { store } = await freshStore();
    const base: ValidationCheck = { name: "X", role: "contrast", median_percentile: 1, passed: true };
    store.getState().focusCheck({ ...base, bbox: [10, 20, 30, 40] });
    expect(store.getState().focus).toEqual({ lat: 30, lon: 20 });
    store.getState().focusCheck({ ...base, name: "McMurdo Dry Valleys" });
    expect(store.getState().focus?.lat).toBeCloseTo(-77.6);
    expect(store.getState().focus?.lon).toBeCloseTo(161.75);
    store.getState().openValidation(true);
    expect(store.getState().validationOpen).toBe(true);
  });
  it("rapid selectSite: only the latest selection is applied when the first resolves last", async () => {
    const { ds } = makeDs();
    const gates = new Map<string, () => void>();
    const gated: typeof ds = {
      ...ds,
      async getScoreMap(layer, site) {
        if (site !== "best") await new Promise<void>((r) => gates.set(site, r));
        return ds.getScoreMap(layer, site);
      },
    };
    const store = createAppStore();
    await store.getState().init(gated);
    const first = store.getState().selectSite("hellas_rim");
    const second = store.getState().selectSite(null);
    await second;
    gates.get("hellas_rim")!();
    await first;
    expect(store.getState().siteId).toBeNull();
    expect(store.getState().list).toEqual(topForSite(store.getState().cells, null));
  });

  it("rapid selectLayer then selectSite: both choices are applied", async () => {
    const { ds } = makeDs();
    let release: (() => void) | null = null;
    let hold = false;
    const gated: typeof ds = {
      ...ds,
      async getCells(layer) {
        if (hold) await new Promise<void>((r) => (release = r));
        return ds.getCells(layer);
      },
    };
    const store = createAppStore();
    await store.getState().init(gated);
    await store.getState().selectLayer("1-5m"); // pending, unavailable
    hold = true;
    const layerCall = store.getState().selectLayer("0-1m");
    hold = false;
    const siteCall = store.getState().selectSite("hellas_rim");
    (release as unknown as () => void)();
    await Promise.all([layerCall, siteCall]);
    const s = store.getState();
    expect(s.layer).toBe("0-1m");
    expect(s.layerPending).toBe(false);
    expect(s.siteId).toBe("hellas_rim");
    expect(s.list).toHaveLength(6);
  });

  it("rapid selectSite then selectLayer: the site pick survives the layer change", async () => {
    const { ds } = makeDs();
    let release: (() => void) | null = null;
    let first = true;
    const gated: typeof ds = {
      ...ds,
      async getScoreMap(layer, site) {
        if (site === "hellas_rim" && first) {
          first = false;
          await new Promise<void>((r) => (release = r));
        }
        return ds.getScoreMap(layer, site);
      },
    };
    const store = createAppStore();
    await store.getState().init(gated);
    const siteCall = store.getState().selectSite("hellas_rim");
    const layerCall = store.getState().selectLayer("0-1m");
    await layerCall;
    (release as unknown as () => void)();
    await siteCall;
    const s = store.getState();
    expect(s.siteId).toBe("hellas_rim");
    expect(s.layer).toBe("0-1m");
    expect(s.list).toHaveLength(6);
  });

  it("clicking an unavailable layer does not cancel a pending site pick", async () => {
    const { ds } = makeDs();
    let release: (() => void) | null = null;
    const gated: typeof ds = {
      ...ds,
      async getScoreMap(layer, site) {
        if (site === "hellas_rim") await new Promise<void>((r) => (release = r));
        return ds.getScoreMap(layer, site);
      },
    };
    const store = createAppStore();
    await store.getState().init(gated);
    const siteCall = store.getState().selectSite("hellas_rim");
    await store.getState().selectLayer("gt5m");
    expect(store.getState().layerPending).toBe(true);
    (release as unknown as () => void)();
    await siteCall;
    expect(store.getState().siteId).toBe("hellas_rim");
    expect(store.getState().layerPending).toBe(true);
    expect(store.getState().layer).toBe("0-1m");
  });
});
