import type { EarthGlobeHandle } from "../scene/EarthGlobe";
import type { MarsGlobeHandle } from "../scene/MarsGlobe";

/**
 * Handles the timelines drive. Filled by useMotion once the scenes mount; empty in tests and
 * without WebGL, where every timeline then only touches the DOM.
 */
export const motion: {
  mars: MarsGlobeHandle | null;
  earth: EarthGlobeHandle | null;
  /** True while a site pick will fly the Earth itself (the focus effect must not). */
  holdFly: boolean;
  /** True from mount until the intro ends: the card build is part of the intro. */
  introActive: boolean;
  /** True while the opening video plays: the 3D intro waits for it. */
  videoPlaying: boolean;
  /**
   * Re-render the 3D views so they pick up their slots' new sizes. drei's View reads the slot size
   * only when it renders, and a grid change (pick -> explore) does not resize the canvas. Set by Stage.
   */
  relayout: (() => void) | null;
} = { mars: null, earth: null, holdFly: false, introActive: false, videoPlaying: false, relayout: null };

// videoPlaying is observable: the 3D stage stops rendering while the drill intro covers it.
const listeners = new Set<() => void>();
let videoPlaying = false;
Object.defineProperty(motion, "videoPlaying", {
  get: () => videoPlaying,
  set: (v: boolean) => {
    if (v === videoPlaying) return;
    videoPlaying = v;
    listeners.forEach((l) => l());
  },
});

/** Subscribe to videoPlaying changes; returns the unsubscribe (useSyncExternalStore shape). */
export function onVideoPlaying(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
