import { useEffect, useState, type RefObject } from "react";
import { appStore } from "../state/store";
import type { EarthGlobeHandle } from "../scene/EarthGlobe";
import type { MarsGlobeHandle } from "../scene/MarsGlobe";
import { chooseIntro, markSeen, prefersReducedMotion, readSeen, type IntroKind } from "./intro";
import { motion } from "./registry";
import { introTimeline, pickSiteTimeline } from "./timelines";

const READY_TIMEOUT_MS = 12000;

/**
 * Wires the scene handles into the motion registry, plays the intro once the scenes and data
 * are ready, and runs the pick-site timeline on every site change. Returns whether the intro
 * veil should still be mounted. Never blocks input: any click or key jumps the intro to its end.
 */
export function useMotion(
  marsRef: RefObject<MarsGlobeHandle | null>,
  earthRef: RefObject<EarthGlobeHandle | null>,
  enabled: boolean,
): boolean {
  const [kind] = useState<IntroKind>(() => (enabled ? chooseIntro(readSeen(), prefersReducedMotion()) : "none"));
  const [veil, setVeil] = useState(kind !== "none");

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let intro: ReturnType<typeof introTimeline> | null = null;
    const started = performance.now();
    motion.introActive = kind !== "none"; // from the first frame: the card must not build on its own before the intro does

    const skip = () => void intro?.progress(1);
    const endIntro = () => {
      motion.introActive = false;
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
      setVeil(false);
    };

    const ready = () => {
      motion.mars = marsRef.current;
      motion.earth = earthRef.current;
      const scenes = motion.mars !== null && motion.earth !== null;
      if (kind === "none") {
        if (!scenes) raf = requestAnimationFrame(ready);
        return;
      }
      if (!(scenes && appStore.getState().manifest !== null)) {
        if (performance.now() - started > READY_TIMEOUT_MS) endIntro();
        else raf = requestAnimationFrame(ready);
        return;
      }
      markSeen();
      window.addEventListener("pointerdown", skip, true);
      window.addEventListener("keydown", skip, true);
      intro = introTimeline(kind, endIntro);
    };
    raf = requestAnimationFrame(ready);

    // Pick site: Mars turn + rings, then the Earth echo.
    const unsubscribe = appStore.subscribe((s, prev) => {
      if (!s.siteId || s.siteId === prev.siteId) return;
      const site = s.sites.find((x) => x.id === s.siteId);
      const cell = s.list[0];
      if (!site || !cell) return;
      if (motion.introActive) skip();
      pickSiteTimeline(site.lat, site.lon, cell);
    });

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      intro?.kill();
      motion.earth?.setReveal(Math.PI); // a killed intro must never leave the heat hidden
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
      motion.mars = motion.earth = null;
      motion.introActive = false;
      motion.holdFly = false;
    };
  }, [enabled, kind, marsRef, earthRef]);

  return veil;
}
