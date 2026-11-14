import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDataSource, LayerUnavailableError } from "./source";

const dir = join(process.cwd(), "public", "mock-data");
const mockFetch = () =>
  vi.fn(async (url: string | URL | Request) => {
    const name = String(url).replace("/mock-data/", "");
    try {
      return new Response(readFileSync(join(dir, name), "utf8"), { status: 200 });
    } catch {
      return new Response("<html>", { status: 404 });
    }
  });
const asFetch = (f: ReturnType<typeof mockFetch>) => f as unknown as typeof fetch;

describe("data source", () => {
  it("rejects an unavailable layer without fetching data files", async () => {
    const f = mockFetch();
    const ds = createDataSource("/mock-data/", asFetch(f));
    await expect(ds.getCells("1-5m")).rejects.toBeInstanceOf(LayerUnavailableError);
    await expect(ds.getScoreMap("gt5m", "best")).rejects.toBeInstanceOf(LayerUnavailableError);
    await expect(ds.getValidation("1-5m")).rejects.toBeInstanceOf(LayerUnavailableError);
    expect(f.mock.calls.map((c) => c[0])).toEqual(["/mock-data/manifest.json"]);
  });

  it("flattens cells with lat/lon from coordinates and memoises", async () => {
    const f = mockFetch();
    const ds = createDataSource("/mock-data", asFetch(f));
    const cells = await ds.getCells("0-1m");
    expect(cells[0].lat).toBeCloseTo(75.55);
    expect(cells[0].lon).toBeCloseTo(-89.75);
    expect(cells[0].tied_site_ids.length).toBeGreaterThan(0);
    await ds.getCells("0-1m");
    expect(f.mock.calls.filter((c) => String(c[0]).includes("cells_top"))).toHaveLength(1);
  });

  it("loads mars sites and validation checks", async () => {
    const ds = createDataSource("/mock-data/", asFetch(mockFetch()));
    const sites = await ds.getMarsSites();
    const arcadia = sites.find((s) => s.id === "arcadia_planitia")!;
    expect(arcadia.lon).toBe(-170);
    expect(arcadia.lat).toBe(42);
    expect((await ds.getValidation("0-1m")).length).toBeGreaterThan(0);
  });

  it("decodes the score map via the injected decoder and memoises", async () => {
    const decode = vi.fn(async (_url: string) => ({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]),
    }));
    const ds = createDataSource("/mock-data/", asFetch(mockFetch()), decode);
    const m = await ds.getScoreMap("0-1m", "best");
    expect(m.sample(0, -90)).toBe(1);
    expect(m.sample(0, 90)).toBeNull();
    await ds.getScoreMap("0-1m", "best");
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledWith("/mock-data/score_0-1m_best.png");
    await expect(ds.getScoreMap("0-1m", "nope")).rejects.toBeInstanceOf(LayerUnavailableError);
  });

  it("fails loudly on HTTP errors and non-JSON bodies, naming the URL", async () => {
    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    await expect(createDataSource("/x/", notFound as unknown as typeof fetch).getManifest()).rejects.toThrow(
      /\/x\/manifest\.json.*404/,
    );
    const html = vi.fn(async () => new Response("<!doctype html>", { status: 200 }));
    await expect(createDataSource("/y/", html as unknown as typeof fetch).getManifest()).rejects.toThrow(
      /\/y\/manifest\.json/,
    );
  });
});
