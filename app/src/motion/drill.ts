// Hold-to-drill intro: progress through the opening clip, 0 (Mars) .. 1 (ice core).

export const CAPTIONS = [
  "Mars hides its water as ice, under the dust.",
  "Earth has places with the same frozen ground.",
  "Before we drill there, we practice here.",
] as const;

/** Rewind speed relative to playback when the visitor lets go. */
const REWIND = 1.5;

/** Advance progress by dt seconds: forward at 1x while holding, back at 1.5x otherwise. */
export function stepProgress(p: number, holding: boolean, dt: number, duration: number): number {
  if (!(duration > 0)) return p;
  const next = p + ((holding ? 1 : -REWIND) * dt) / duration;
  return Math.min(1, Math.max(0, next));
}

/** Which caption shows at progress p: thirds of the clip. */
export function captionIndex(p: number): 0 | 1 | 2 {
  if (p < 1 / 3) return 0;
  if (p < 2 / 3) return 1;
  return 2;
}
