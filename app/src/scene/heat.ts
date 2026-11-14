// Heat map opacity. JS twin of heatAlpha() in heatMaterial.ts: keep the two in sync.

/** Opacity at score 1. */
export const HEAT_MAX = 0.85;
/** Opacity at the threshold in "top 10 %" mode: the faintest visible blob. */
export const HEAT_MIN_TOP = 0.3;
/** Opacity at score 0 in "Show all" mode. */
export const HEAT_MIN_ALL = 0.04;

/**
 * Opacity of the frost-white heat overlay for one pixel.
 * `alpha` is the PNG alpha (0 = no permafrost → always 0). Without `showAll`, scores below
 * `threshold` (top 10 % of the current map) are hidden; visible scores ramp up to HEAT_MAX.
 */
export function heatAlpha(score: number, alpha: number, threshold: number, showAll: boolean): number {
  if (alpha <= 0) return 0;
  if (showAll) return HEAT_MIN_ALL + (HEAT_MAX - HEAT_MIN_ALL) * clamp01(score);
  if (score < threshold) return 0;
  const t = threshold >= 1 ? 1 : (score - threshold) / (1 - threshold);
  return HEAT_MIN_TOP + (HEAT_MAX - HEAT_MIN_TOP) * clamp01(t);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
