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
} = { mars: null, earth: null, holdFly: false, introActive: false };
