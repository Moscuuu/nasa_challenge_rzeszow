// Heat map formulas. JS twins of the GLSL in heatMaterial.ts: keep the two in sync.

/** Opacity at score 1. */
export const HEAT_MAX = 0.85;
/** Opacity at the threshold in "top 10 %" mode: the faintest visible blob. */
export const HEAT_MIN_TOP = 0.3;
/** Opacity at score 0 in "Show all" mode. */
export const HEAT_MIN_ALL = 0.04;
/** Share of the heat left at the pulse centre, so the rings stay visible on dense heat. */
export const PULSE_CLEAR_MIN = 0.25;
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
 * Opacity of the frost-white heat overlay at one point.
 * `mask` is the filtered permafrost mask: below 0.5 counts as no permafrost → always 0, so heat
 * never bleeds more than half a texel past the permafrost edge. Without `showAll`, scores below
 * `threshold` (top 10 % of the current map) are hidden; visible scores ramp up to HEAT_MAX.
 */
export function heatAlpha(score: number, mask: number, threshold: number, showAll: boolean): number {
  if (mask < 0.5) return 0;
  if (showAll) return HEAT_MIN_ALL + (HEAT_MAX - HEAT_MIN_ALL) * clamp01(score);
  if (score < threshold) return 0;
  const t = threshold >= 1 ? 1 : (score - threshold) / (1 - threshold);
  return HEAT_MIN_TOP + (HEAT_MAX - HEAT_MIN_TOP) * clamp01(t);
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
