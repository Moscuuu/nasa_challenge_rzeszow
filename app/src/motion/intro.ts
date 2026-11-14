export type IntroKind = "full" | "short" | "none";

const KEY = "af-intro-seen";

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Full on the first visit, short afterwards, none with reduced motion. */
export function chooseIntro(seen: boolean, reducedMotion: boolean): IntroKind {
  if (reducedMotion) return "none";
  return seen ? "short" : "full";
}

export function readSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: the full intro simply plays again */
  }
}

/** Forget the visit, so the next load plays the first-visit intro (footer "Replay intro"). */
export function clearSeen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing stored to clear */
  }
}
