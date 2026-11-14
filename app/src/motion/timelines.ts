import gsap from "gsap";
import type { Cell, LayerId } from "../data/types";
import { prefersReducedMotion, type IntroKind } from "./intro";
import { appStore } from "../state/store";
import { motion } from "./registry";

type Tl = gsap.core.Timeline;

const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/** Reduced motion: every timeline is a single cross-fade of at most 200 ms. */
const FADE = 0.2;

/** Card build: border draws, score counts up, bars fill in order, `breaks_down` rows glitch (monochrome). */
export function cardBuildTimeline(card: HTMLElement): Tl {
  const tl = gsap.timeline();
  if (prefersReducedMotion()) {
    tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: FADE });
    return tl;
  }
  tl.set(card, { opacity: 1 });
  tl.fromTo(card, { "--draw": 0 }, { "--draw": 1, duration: 0.7, ease: "power2.out" }, 0);

  const score = qs(".card-score", card);
  const text = score?.textContent?.trim() ?? "";
  if (score && /^\d+(\.\d+)?$/.test(text)) {
    const v = { n: 0 };
    tl.to(
      v,
      {
        n: Number(text),
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => void (score.textContent = v.n.toFixed(2)),
        onComplete: () => void (score.textContent = text),
      },
      0.3,
    );
  }

  const bars = qsa(".f-bar i", card);
  if (bars.length) {
    tl.fromTo(
      bars,
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: "left center", duration: 0.45, ease: "power2.out", stagger: 0.09 },
      0.45,
    );
  }

  // Short monochrome glitch on the rows that break down: clip-path jitter and a 3 px shift only.
  qsa(".features li[data-break]", card).forEach((row, i) => {
    const at = 0.45 + bars.length * 0.09 + 0.1 + i * 0.12;
    tl.set(row, { clipPath: "inset(8% 0 52% 0)", x: -3 }, at)
      .set(row, { clipPath: "inset(48% 0 6% 0)", x: 3 }, at + 0.06)
      .set(row, { clipPath: "inset(0% 0 0% 0)", x: -2 }, at + 0.12)
      .set(row, { clearProps: "clipPath,x" }, at + 0.18);
  });
  return tl;
}

/** Pick layer: the block splits like a core sample, the chosen slab slides forward, the others dim. */
export function pickLayerTimeline(layer: LayerId): Tl {
  const tl = gsap.timeline();
  const slabs = qsa<HTMLElement>(".slab");
  const chosen = slabs.find((s) => s.dataset.layer === layer);
  if (!chosen) return tl;
  const others = slabs.filter((s) => s !== chosen);
  if (prefersReducedMotion()) {
    tl.to(chosen, { opacity: 1, duration: FADE }).to(others, { opacity: 0.45, duration: FADE }, 0);
    return tl;
  }
  gsap.killTweensOf(slabs);
  tl.to(slabs, { y: (i: number) => (i - 1) * 9, duration: 0.3, ease: "power2.out" }, 0) // split open
    .to(chosen, { x: 14, scale: 1.04, opacity: 1, duration: 0.45, ease: "power3.out" }, 0.1) // slides forward
    .to(others, { x: 0, scale: 1, opacity: 0.45, duration: 0.4, ease: "power2.out" }, 0.1)
    .to(slabs, { y: (i: number) => (i - 1) * 4, duration: 0.4, ease: "power2.inOut" }, 0.45); // settle, stay slightly open
  return tl;
}

let current: Tl | null = null;

/**
 * Pick site: Mars turns to the pin (eased inertia in the scene) and radar rings sweep the surface;
 * as they finish, Earth echoes: pulse, heat spreading from the site's best cell, camera to the cell.
 */
export function pickSiteTimeline(lat: number, lon: number, cell: Cell): Tl {
  current?.kill();
  const { mars, earth } = motion;
  const tl = (current = gsap.timeline());
  motion.holdFly = true;
  earth?.setReveal(0);
  earth?.setPulseVisible(false);
  mars?.rotateTo(lat, lon);

  const echo = () => {
    motion.holdFly = false;
    earth?.setPulseVisible(true);
    const f = appStore.getState().focus;
    earth?.flyTo(f?.lat ?? cell.lat, f?.lon ?? cell.lon);
  };
  const end = () => {
    mars?.radar(lat, lon, null);
    echo();
    earth?.setReveal(Math.PI);
  };

  if (prefersReducedMotion()) {
    tl.to({}, { duration: FADE, onComplete: end });
    return tl;
  }
  const p = { rings: 0, reveal: 0 };
  tl.to(p, { rings: 1, duration: 1.6, ease: "none", onUpdate: () => mars?.radar(lat, lon, p.rings) }, 0.35)
    .call(() => mars?.radar(lat, lon, null))
    .call(echo)
    .to(p, { reveal: Math.PI, duration: 1.2, ease: "power2.inOut", onUpdate: () => earth?.setReveal(p.reveal) }, ">0.1")
    .eventCallback("onComplete", end);
  return tl;
}

/**
 * Intro. full (~5 s): black, Mars passes close, the pins flicker in, camera pulls back as Mars
 * settles left and Earth rises, heat spreads from global #1 with the pulse, card builds.
 * short (~1.5 s): from the heat-map step. Any click or key jumps to the end (see useMotion).
 */
export function introTimeline(kind: Exclude<IntroKind, "none">, onDone?: () => void): Tl {
  const { mars, earth } = motion;
  const veil = qs(".intro-veil");
  const marsSlot = qs('[data-slot="mars"]');
  const earthSlot = qs('[data-slot="earth"]');
  const card = qs(".card");
  const full = kind === "full";

  const s = { veil: 1, zoom: full ? 0.42 : 1, pins: full ? 0 : 1, earth: full ? 0 : 1, reveal: 0 };
  const apply = () => {
    if (veil) veil.style.opacity = String(s.veil);
    mars?.setIntro({ zoom: s.zoom, pins: s.pins });
    earth?.setIntro({ scale: s.earth });
    earth?.setReveal(s.reveal);
  };
  // Starting state, applied now (before the first tick) so nothing flashes.
  apply();
  earth?.setPulseVisible(false);
  if (card) gsap.set(card, { opacity: 0 });
  if (full) {
    if (marsSlot) gsap.set(marsSlot, { xPercent: 35 });
    if (earthSlot) gsap.set(earthSlot, { yPercent: 8 });
  }

  const tl = gsap.timeline({ onUpdate: apply });
  const revealAt = full ? 3.9 : 0.3;
  if (full) {
    tl.to(s, { veil: 0, duration: 0.9, ease: "power1.inOut" }, 0.2)
      .to(s, { zoom: 0.55, duration: 2.8, ease: "none" }, 0) // Mars drifts past, close
      .to(s, { pins: 1, duration: 1.6, ease: "none" }, 1.0) // pins flicker in turn
      .to(s, { zoom: 1, duration: 1.4, ease: "power2.inOut" }, 2.8) // camera pulls back
      .to(s, { earth: 1, duration: 1.2, ease: "power2.out" }, 3.0); // Earth rises
    if (marsSlot) tl.to(marsSlot, { xPercent: 0, duration: 1.4, ease: "power2.inOut" }, 2.8); // Mars settles left
    if (earthSlot) tl.to(earthSlot, { yPercent: 0, duration: 1.2, ease: "power2.out" }, 3.0);
  } else {
    tl.to(s, { veil: 0, duration: 0.35, ease: "power1.out" }, 0);
  }
  tl.call(() => earth?.setPulseVisible(true), [], revealAt).to(
    s,
    { reveal: Math.PI, duration: full ? 1.1 : 0.9, ease: "power2.inOut" },
    revealAt,
  );
  if (card) tl.add(cardBuildTimeline(card), full ? 4.3 : 1.0);

  tl.eventCallback("onComplete", () => {
    Object.assign(s, { veil: 0, zoom: 1, pins: 1, earth: 1, reveal: Math.PI });
    apply();
    earth?.setPulseVisible(true);
    if (card) gsap.set(card, { opacity: 1, "--draw": 1 });
    gsap.set([marsSlot, earthSlot].filter(Boolean), { clearProps: "transform" });
    onDone?.();
  });
  return tl;
}
