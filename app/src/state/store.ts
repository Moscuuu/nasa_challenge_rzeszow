import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { CHECK_BOXES } from "../data/checkBoxes";
import { nearestTopCell, topForSite } from "../data/cells";
import type { ScoreMap } from "../data/scoreMap";
import { LayerUnavailableError, type DataSource } from "../data/source";
import type { Cell, LayerId, Manifest, MarsSite, ValidationCheck } from "../data/types";

export type EarthHit =
  | { kind: "cell"; cell: Cell }
  | { kind: "score"; score: number; lat: number; lon: number }
  | { kind: "none"; lat: number; lon: number };

export interface AppState {
  manifest: Manifest | null;
  sites: MarsSite[];
  cells: Cell[];
  scoreMap: ScoreMap | null;
  checks: ValidationCheck[];
  siteId: string | null;
  layer: LayerId;
  layerPending: boolean;
  list: Cell[];
  index: number;
  earthHit: EarthHit | null;
  showAll: boolean;
  validationOpen: boolean;
  focus: { lat: number; lon: number } | null;
  init(ds: DataSource): Promise<void>;
  selectSite(id: string | null): Promise<void>;
  selectLayer(layer: LayerId): Promise<void>;
  step(delta: 1 | -1): void;
  clickEarth(lat: number, lon: number): void;
  toggleShowAll(): void;
  openValidation(open: boolean): void;
  focusCheck(check: ValidationCheck): void;
}

const DEFAULT_LAYER: LayerId = "0-1m";
const pointOf = (c: Cell | undefined) => (c ? { lat: c.lat, lon: c.lon } : null);

export function currentCell(s: Pick<AppState, "earthHit" | "list" | "index">): Cell | null {
  return s.earthHit?.kind === "cell" ? s.earthHit.cell : (s.list[s.index] ?? null);
}

export function createAppStore() {
  let source: DataSource | null = null;
  const ds = (): DataSource => {
    if (!source) throw new Error("Store not initialised: call init(ds) first");
    return source;
  };
  // Request token: selectSite / selectLayer apply their async result only if no newer
  // selection started meanwhile (fast pin or layer clicks).
  let latest = 0;

  return createStore<AppState>()((set, get) => ({
    manifest: null,
    sites: [],
    cells: [],
    scoreMap: null,
    checks: [],
    siteId: null,
    layer: DEFAULT_LAYER,
    layerPending: false,
    list: [],
    index: 0,
    earthHit: null,
    showAll: false,
    validationOpen: false,
    focus: null,

    async init(dataSource) {
      source = dataSource;
      const layer = DEFAULT_LAYER;
      const [manifest, sites, cells, scoreMap, checks] = await Promise.all([
        dataSource.getManifest(),
        dataSource.getMarsSites(),
        dataSource.getCells(layer),
        dataSource.getScoreMap(layer, "best"),
        dataSource.getValidation(layer),
      ]);
      const list = topForSite(cells, null);
      set({ manifest, sites, cells, scoreMap, checks, siteId: null, layer, layerPending: false, list, index: 0, earthHit: null, focus: pointOf(list[0]) });
    },

    async selectSite(id) {
      const token = ++latest;
      const { layer, cells } = get();
      const scoreMap = await ds().getScoreMap(layer, id ?? "best");
      if (token !== latest) return;
      const list = topForSite(cells, id);
      set({ siteId: id, scoreMap, list, index: 0, earthHit: null, focus: pointOf(list[0]) });
    },

    async selectLayer(layer) {
      const token = ++latest;
      const { manifest, siteId } = get();
      if (!manifest?.layers.find((l) => l.id === layer)?.available) {
        set({ layerPending: true });
        return;
      }
      try {
        const [cells, scoreMap, checks] = await Promise.all([
          ds().getCells(layer),
          ds().getScoreMap(layer, siteId ?? "best"),
          ds().getValidation(layer),
        ]);
        if (token !== latest) return;
        const list = topForSite(cells, siteId);
        set({ layer, cells, scoreMap, checks, list, index: 0, earthHit: null, layerPending: false, focus: pointOf(list[0]) });
      } catch (e) {
        if (token !== latest) return;
        if (e instanceof LayerUnavailableError) set({ layerPending: true });
        else throw e;
      }
    },

    step(delta) {
      const { list, index } = get();
      if (list.length === 0) return;
      const next = (((index + delta) % list.length) + list.length) % list.length;
      set({ index: next, earthHit: null, focus: pointOf(list[next]) });
    },

    clickEarth(lat, lon) {
      const { cells, scoreMap } = get();
      const cell = nearestTopCell(cells, lat, lon);
      if (cell) return set({ earthHit: { kind: "cell", cell } });
      const score = scoreMap?.sample(lat, lon) ?? null;
      set({ earthHit: score === null ? { kind: "none", lat, lon } : { kind: "score", score, lat, lon } });
    },

    toggleShowAll: () => set((s) => ({ showAll: !s.showAll })),
    openValidation: (open) => set({ validationOpen: open }),

    focusCheck(check) {
      const box = check.bbox ?? CHECK_BOXES[check.name];
      if (box) set({ focus: { lat: (box[1] + box[3]) / 2, lon: (box[0] + box[2]) / 2 } });
    },
  }));
}

export const appStore = createAppStore();
export const useAppStore = <T>(selector: (s: AppState) => T): T => useStore(appStore, selector);
