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

/**
 * pick: Mars alone, centred, waiting for a site. depth: site chosen, Mars locked, only the soil depth
 * can be chosen. explore: Mars + depth + Earth (+ card once an Earth spot is clicked).
 */
export type Stage = "pick" | "depth" | "explore";

export interface AppState {
  stage: Stage;
  /** The details card shows only after the user clicks a spot on Earth. */
  cardOpen: boolean;
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
  validationOpen: boolean;
  focus: { lat: number; lon: number } | null;
  init(ds: DataSource): Promise<void>;
  selectSite(id: string | null): Promise<void>;
  selectLayer(layer: LayerId): Promise<void>;
  step(delta: 1 | -1): void;
  /** Make match i of the list current (camera focus and pulse go there) and open its card. */
  selectMatch(i: number): void;
  clickEarth(lat: number, lon: number): void;
  openValidation(open: boolean): void;
  focusCheck(check: ValidationCheck): void;
  /** Skip the pick step (no WebGL: there are no pins to click). */
  enterExplore(openCard?: boolean): void;
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
  // Selection intent: the site and layer the user asked for last. Every load fetches
  // with both current wishes; only the latest load (request token) applies its result,
  // so fast pin / layer clicks never apply a stale result or drop the other choice.
  let wantSite: string | null = null;
  let wantLayer: LayerId = DEFAULT_LAYER;
  let wantPending = false; // last layer click was an undelivered layer
  let latest = 0;

  return createStore<AppState>()((set, get) => {
    async function load(): Promise<void> {
      const token = ++latest;
      const site = wantSite;
      const layer = wantLayer;
      try {
        const [cells, scoreMap, checks] = await Promise.all([
          ds().getCells(layer),
          ds().getScoreMap(layer, site ?? "best"),
          ds().getValidation(layer),
        ]);
        if (token !== latest) return;
        const list = topForSite(cells, site);
        set({ siteId: site, layer, cells, scoreMap, checks, list, index: 0, earthHit: null, layerPending: wantPending, focus: pointOf(list[0]) });
      } catch (e) {
        if (token !== latest) return;
        if (!(e instanceof LayerUnavailableError)) throw e;
        wantLayer = get().layer; // stay on the delivered layer
        wantPending = true;
        set({ layerPending: true });
      }
    }

    return {
      stage: "pick",
      cardOpen: false,
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
      validationOpen: false,
      focus: null,

      async init(dataSource) {
        source = dataSource;
        const layer = DEFAULT_LAYER;
        wantSite = null;
        wantLayer = layer;
        wantPending = false;
        latest++;
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

      selectSite(id) {
        wantSite = id;
        // A new site means new matches: close the card until the user clicks Earth again.
        set(id && get().stage === "pick" ? { stage: "depth", cardOpen: false } : { cardOpen: false });
        return load();
      },

      selectLayer(layer) {
        if (!get().manifest?.layers.find((l) => l.id === layer)?.available) {
          // No fetch and no new load: a pending site pick still lands.
          wantPending = true;
          set({ layerPending: true });
          return Promise.resolve();
        }
        wantLayer = layer;
        wantPending = false;
        // Depth step: choosing an available depth opens the main view.
        if (get().stage === "depth") set({ stage: "explore", cardOpen: false });
        return load();
      },

      step(delta) {
        const { list, index } = get();
        if (list.length === 0) return;
        const next = (((index + delta) % list.length) + list.length) % list.length;
        set({ index: next, earthHit: null, focus: pointOf(list[next]) });
      },

      selectMatch(i) {
        const { list } = get();
        if (i < 0 || i >= list.length) return;
        set({ index: i, earthHit: null, focus: pointOf(list[i]), cardOpen: true });
      },

      clickEarth(lat, lon) {
        const { cells, scoreMap } = get();
        const cell = nearestTopCell(cells, lat, lon);
        if (cell) return set({ earthHit: { kind: "cell", cell }, cardOpen: true });
        const score = scoreMap?.sample(lat, lon) ?? null;
        set({ earthHit: score === null ? { kind: "none", lat, lon } : { kind: "score", score, lat, lon }, cardOpen: true });
      },

      enterExplore: (openCard = false) => set({ stage: "explore", cardOpen: openCard }),
      openValidation: (open) => set({ validationOpen: open }),

      focusCheck(check) {
        const box = check.bbox ?? CHECK_BOXES[check.name];
        if (box) set({ focus: { lat: (box[1] + box[3]) / 2, lon: (box[0] + box[2]) / 2 } });
      },
    };
  });
}

export const appStore = createAppStore();
export const useAppStore = <T>(selector: (s: AppState) => T): T => useStore(appStore, selector);
