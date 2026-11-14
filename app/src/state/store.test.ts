import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createDataSource } from "../data/source";
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

  it("toggleShowAll survives selectSite; selectSite clears earthHit", async () => {
    const { store } = await freshStore();
    store.getState().toggleShowAll();
    store.getState().clickEarth(0, -30);
    await store.getState().selectSite("hellas_rim");
    expect(store.getState().showAll).toBe(true);
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
});
