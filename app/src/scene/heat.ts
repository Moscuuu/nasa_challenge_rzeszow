// Heat map formulas. JS twins of the GLSL in heatMaterial.ts: keep the two in sync.

/** Opacity of a fully hot, fully permafrost pixel in "top 10 %" mode. */
export const HEAT_CORE = 0.2;
/** Peak opacity of the soft halo around hot regions. */
export const HEAT_HALO = 0.08;
/** Darkening of the satellite base away from the hot regions in "top 10 %" mode (hot areas read as lit). */
export const HEAT_DIM = 0.6;
/** Opacity of the 1 px frost contour around the hot regions. */
export const HOT_CONTOUR = 0.9;
/** Share of the heat left at the pulse centre, so the rings stay visible on dense heat. */
export const PULSE_CLEAR_MIN = 0.45;
/** Largest pulse ring radius, in globe radii (≈ radians on the unit sphere). */
export const PULSE_RADIUS = 0.15;
/** Smallest mask used as a divisor when unpacking a texel. */
export const MASK_EPS = 1e-3;

/**
 * Score and mask from one filtered texel of the RG score texture (R = score · mask, G = mask).
 * Dividing by the mask undoes the dilution by no-permafrost texels, so filtering never pulls
 * a score down at the permafrost edge.
 */
export function unpackTexel(r: number, g: number): { score: number; mask: number } {
  return { score: g > 0 ? Math.min(1, r / Math.max(g, MASK_EPS)) : 0, mask: g };
}

/**
 * "Top 10 %" mode opacity. `hot` = filtered share of top-10 % texels (texture B, fine mip bias),
 * `halo` = the same channel at a much coarser mip, a soft glow so small clusters stay findable
 * at far zoom. `mask` = filtered permafrost mask (core only; the glow may spill a little).
 */
export function topHeatAlpha(hot: number, halo: number, mask: number): number {
  const core = mask < 0.5 ? 0 : HEAT_CORE * smoothstep(0.2, 0.6, hot);
  return Math.max(core, HEAT_HALO * smoothstep(0.02, 0.5, halo));
}

/**
 * "Top 10 %" mode darkening of the base imagery (black overlay opacity). 0 inside hot regions, a
 * little lit around them (halo), HEAT_DIM elsewhere: snow and ice that is not hot goes dark.
 */
export function topDimAlpha(hot: number, halo: number): number {
  const lit = Math.max(smoothstep(0.15, 0.5, hot), 0.7 * smoothstep(0.02, 0.5, halo));
  return HEAT_DIM * (1 - lit);
}

/** 1 px iso-contour of the filtered hot channel at 0.5; `fw` = its screen-space derivative width. */
export function hotContour(hot: number, fw: number): number {
  return 1 - smoothstep(0, Math.max(fw, 1e-4), Math.abs(hot - 0.5));
}

/** Heat multiplier around the pulse: PULSE_CLEAR_MIN at its centre, 1 from `radius` outwards. */
export function pulseClear(angle: number, radius: number): number {
  if (radius <= 0) return 1;
  return PULSE_CLEAR_MIN + (1 - PULSE_CLEAR_MIN) * smoothstep(0, radius, angle);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
