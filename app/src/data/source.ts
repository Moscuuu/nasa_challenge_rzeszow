import { decodePng, ScoreMap, type RasterLike } from "./scoreMap";
import type { Cell, LayerId, Manifest, MarsSite, Validation, ValidationCheck } from "./types";

export class LayerUnavailableError extends Error {
  constructor(
    public readonly layer: LayerId,
    what = "data",
  ) {
    super(`Layer ${layer} is not available (${what})`);
    this.name = "LayerUnavailableError";
  }
}

export interface DataSource {
  getManifest(): Promise<Manifest>;
  getMarsSites(): Promise<MarsSite[]>;
  getCells(layer: LayerId): Promise<Cell[]>;
  getScoreMap(layer: LayerId, site: string | "best"): Promise<ScoreMap>;
  getValidation(layer: LayerId): Promise<ValidationCheck[]>;
}

type Decode = (url: string) => Promise<RasterLike>;

interface PointFeature<P> {
  geometry: { coordinates: [number, number] };
  properties: P;
}

export function createDataSource(
  base: string,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  decode: Decode = (url) => decodePng(url, fetchImpl),
): DataSource {
  const root = base.endsWith("/") ? base : base + "/";
  const cache = new Map<string, Promise<unknown>>();
  const memo = <T>(url: string, load: () => Promise<T>): Promise<T> => {
    let p = cache.get(url) as Promise<T> | undefined;
    if (!p) {
      p = load();
      cache.set(url, p);
      p.catch(() => cache.delete(url));
    }
    return p;
  };

  const json = <T>(file: string): Promise<T> => {
    const url = root + file;
    return memo(url, async () => {
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        throw new Error(`Invalid JSON from ${url}: ${(e as Error).message}`);
      }
    });
  };

  const getManifest = () => json<Manifest>("manifest.json");

  /** Resolves a manifest file entry for an available layer; throws before fetching any data file otherwise. */
  async function layerFile(layer: LayerId, pick: (m: Manifest) => string | undefined, what: string): Promise<string> {
    const m = await getManifest();
    const info = m.layers.find((l) => l.id === layer);
    const file = pick(m);
    if (!info?.available || !file) throw new LayerUnavailableError(layer, what);
    return file;
  }

  return {
    getManifest,
    async getMarsSites() {
      const m = await getManifest();
      const fc = await json<{ features: PointFeature<Omit<MarsSite, "lat" | "lon">>[] }>(m.files.mars_sites);
      return fc.features.map((f) => ({
        ...f.properties,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
    },
    async getCells(layer) {
      const file = await layerFile(layer, (m) => m.files.cells_top[layer], "cells");
      const fc = await json<{ features: PointFeature<Omit<Cell, "lat" | "lon">>[] }>(file);
      return fc.features.map((f) => ({
        ...f.properties,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
    },
    async getScoreMap(layer, site) {
      const file = await layerFile(layer, (m) => m.files.score_maps[layer]?.[site], `score map "${site}"`);
      const url = root + file;
      return memo(url, async () => new ScoreMap(await decode(url)));
    },
    async getValidation(layer) {
      const file = await layerFile(layer, (m) => m.files.validation[layer], "validation");
      return (await json<Validation>(file)).checks;
    },
  };
}
