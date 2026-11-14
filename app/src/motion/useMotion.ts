import { useEffect, useRef, useState, type RefObject } from "react";
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
  failed = false,
): boolean {
  const [kind] = useState<IntroKind>(() => (enabled ? chooseIntro(readSeen(), prefersReducedMotion()) : "none"));
  const [veil, setVeil] = useState(kind !== "none");

  const failedRef = useRef(failed);
  failedRef.current = failed;
  // Data failed to load: drop the veil so the error is visible.
  useEffect(() => {
    if (!failed) return;
    motion.introActive = false;
    setVeil(false);
  }, [failed]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let intro: ReturnType<typeof introTimeline> | null = null;
    let started = performance.now();
    motion.introActive = kind !== "none"; // from the first frame: the card must not build on its own before the intro does

    let skipped = false;
    // A skip before the intro has started just ends the veil; the intro then jumps straight to its end.
    const skip = (e?: Event) => {
      if (motion.videoPlaying) return; // the drill intro owns clicks and keys until it hands over
      if (e instanceof KeyboardEvent && e.repeat) return; // a key still held from the drill is not a skip
      skipped = true;
      if (intro) intro.progress(1);
      else endIntro();
    };
    const endIntro = () => {
      motion.introActive = false;
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
      setVeil(false);
    };

    if (kind !== "none") {
      window.addEventListener("pointerdown", skip, true);
      window.addEventListener("keydown", skip, true);
    }

    const ready = () => {
      motion.mars = marsRef.current;
      motion.earth = earthRef.current;
      const scenes = motion.mars !== null && motion.earth !== null;
      if (kind === "none") {
        if (!scenes) raf = requestAnimationFrame(ready);
        return;
      }
      if (failedRef.current) {
        endIntro();
        return;
      }
      if (motion.videoPlaying && !skipped) {
        started = performance.now(); // the ready timeout counts from the end of the video
        raf = requestAnimationFrame(ready);
        return;
      }
      if (!(scenes && appStore.getState().manifest !== null)) {
        if (performance.now() - started > READY_TIMEOUT_MS) endIntro();
        else raf = requestAnimationFrame(ready);
        return;
      }
      markSeen();
      intro = introTimeline(kind, endIntro);
      if (skipped) intro.progress(1);
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
