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
    tl.to(chosen, { opacity: 1, duration: FADE }).to(others, { opacity: 0.7, duration: FADE }, 0);
    return tl;
  }
  gsap.killTweensOf(slabs);
  tl.to(slabs, { y: (i: number) => (i - 1) * 9, duration: 0.3, ease: "power2.out" }, 0) // split open
    .to(chosen, { x: 14, scale: 1.04, opacity: 1, duration: 0.45, ease: "power3.out" }, 0.1) // slides forward
    .to(others, { x: 0, scale: 1, opacity: 0.7, duration: 0.4, ease: "power2.out" }, 0.1)
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

/** Mars camera zoom on the pick step: Mars framed as tightly as Earth (fit margin 1.12 vs 1.3). */
export const PICK_ZOOM = 1.12 / 1.3;
const restZoom = () => (appStore.getState().stage === "explore" ? 1 : PICK_ZOOM);

/** The intro tour ends on this site, and Mars stays turned to it (no idle spin) until the user drags. */
const FOCUS_SITE_ID = "hellas_rim";
const TOUR_START_S = 0.6; // after the veil has mostly lifted
const TOUR_STEP_S = 0.8; // time on each site before turning to the next

const focusSite = () => appStore.getState().sites.find((x) => x.id === FOCUS_SITE_ID);

/** Every site once, eastwards, so the tour ends on the focus site. */
function tourSites() {
  const { sites } = appStore.getState();
  const end = focusSite();
  if (!end) return sites;
  const east = (lon: number) => ((lon - end.lon) % 360 + 360) % 360 || 360;
  return [...sites].sort((a, b) => east(a.lon) - east(b.lon));
}

function focusMarsSite(): void {
  const site = focusSite();
  if (site) motion.mars?.rotateTo(site.lat, site.lon, true);
}

/**
 * Intro. full (~6 s): veil lifts on Mars filling the centre frame, the camera eases back as the
 * analog sites flicker in, and the globe turns to every site in turn (there are many to pick from),
 * eastwards, ending on Hellas rim, where it stays; the sites pulse and wait for a pick (Earth and the
 * card come later). short (~0.5 s): veil fade, then straight to Hellas rim.
 * Any click or key jumps to the end (see useMotion).
 */
export function introTimeline(kind: Exclude<IntroKind, "none">, onDone?: () => void): Tl {
  const { mars } = motion;
  const veil = qs(".intro-veil");
  const full = kind === "full";
  const rest = restZoom();

  // 0.8 is about the closest zoom that still fits the globe inside the slot at the pick framing.
  const s = { veil: 1, zoom: full ? rest * 0.93 : rest, pins: full ? 0 : 1 };
  const apply = () => {
    if (veil) veil.style.opacity = String(s.veil);
    mars?.setIntro({ zoom: s.zoom, pins: s.pins });
  };
  // Starting state, applied now (before the first tick) so nothing flashes.
  apply();

  const tl = gsap.timeline({ onUpdate: apply });
  if (full) {
    tl.to(s, { veil: 0, duration: 0.8, ease: "power1.inOut" }, 0.1)
      .to(s, { zoom: rest, duration: 2.0, ease: "power2.inOut" }, 0.3) // Mars eases back into place
      .to(s, { pins: 1, duration: 1.2, ease: "none" }, 1.0); // sites flicker in turn
    // Tour: every site in turn; the last one is the focus site (held in onComplete).
    // A jump of more than ~half a turn would make rotateTo (shortest way) turn back west: pass a midpoint first.
    const tour = tourSites();
    tour.forEach((site, i) => {
      const t = TOUR_START_S + i * TOUR_STEP_S;
      const prev = tour[i - 1];
      const east = prev ? (((site.lon - prev.lon) % 360) + 360) % 360 : 0;
      if (prev && east > 170) {
        const mid = { lat: (prev.lat + site.lat) / 2, lon: prev.lon + east / 2 };
        tl.call(() => mars?.rotateTo(mid.lat, mid.lon), [], t - TOUR_STEP_S / 2);
      }
      tl.call(() => mars?.rotateTo(site.lat, site.lon), [], t);
    });
    tl.to({}, { duration: 0.01 }, TOUR_START_S + tour.length * TOUR_STEP_S); // end after the last stop
  } else {
    tl.to(s, { veil: 0, duration: 0.35, ease: "power1.out" }, 0);
  }

  tl.eventCallback("onComplete", () => {
    Object.assign(s, { veil: 0, zoom: restZoom(), pins: 1 });
    apply();
    focusMarsSite();
    onDone?.();
  });
  return tl;
}

/** Without an intro, Mars still needs the pick framing. */
export function settleMars(): void {
  motion.mars?.setIntro({ zoom: restZoom(), pins: 1 });
  focusMarsSite();
}

/**
 * Depth -> explore, on the first depth pick: Mars shrinks and glides from the centre into its
 * column (FLIP on its slot), the depth panel rises in beneath it and Earth grows in the centre.
 * The site's radar and Earth echo (pickSiteTimeline) run on top of this.
 */
export function exploreTimeline(): Tl {
  const tl = gsap.timeline();
  const root = qs(".layout");
  const slot = qs('[data-slot="mars"]');
  const soil = qs('[data-slot="soil"]');
  const { mars, earth } = motion;
  if (!root) return tl;
  const panel = soil?.querySelector<HTMLElement>(".soil") ?? null;
  const first = slot?.getBoundingClientRect();
  const panelFirst = panel?.getBoundingClientRect();
  root.dataset.stage = "explore"; // React sets the same value on its next render
  const last = slot?.getBoundingClientRect();
  // Earth was hidden during the depth step: turn it to the best analog as it grows in.
  const f = appStore.getState().focus;
  if (f) {
    motion.holdFly = false;
    earth?.flyTo(f.lat, f.lon);
  }
  const panelLast = panel?.getBoundingClientRect();

  const done = () => {
    if (slot) gsap.set(slot, { clearProps: "transform" });
    delete root.dataset.moving;
    mars?.setIntro({ zoom: 1 });
    earth?.setIntro({ scale: 1 });
    motion.relayout?.();
  };
  if (prefersReducedMotion() || !slot || !first || !last || !first.width || !last.width) {
    done();
    if (soil) tl.fromTo(soil, { opacity: 0 }, { opacity: 1, duration: FADE, clearProps: "opacity" });
    return tl;
  }

  // Uniform scale keeps the slot's final aspect, so the globe never stretches; the globe's size
  // follows min(width, height) of its frame.
  const scale = Math.min(first.width, first.height) / Math.min(last.width, last.height);
  const x = first.left + first.width / 2 - (last.left + last.width / 2);
  const y = first.top + first.height / 2 - (last.top + last.height / 2);
  root.dataset.moving = "";
  gsap.set(slot, { transformOrigin: "50% 50%", x, y, scale });
  earth?.setIntro({ scale: 0 });
  // The views read their new sizes once a frame has seen the new layout.
  requestAnimationFrame(() => requestAnimationFrame(() => motion.relayout?.()));

  const z = { zoom: PICK_ZOOM, earth: 0 };
  tl.to(slot, { x: 0, y: 0, scale: 1, duration: 0.85, ease: "power3.inOut" }, 0)
    .to(z, { zoom: 1, duration: 0.85, ease: "power3.inOut", onUpdate: () => mars?.setIntro({ zoom: z.zoom }) }, 0)
    .to(z, { earth: 1, duration: 1.0, ease: "power3.out", onUpdate: () => earth?.setIntro({ scale: z.earth }) }, 0.4);
  if (panel && panelFirst?.width && panelLast?.width) {
    // The depth panel flies from the centre of the screen into its slot under Mars.
    gsap.set(panel, {
      transformOrigin: "50% 50%",
      x: panelFirst.left + panelFirst.width / 2 - (panelLast.left + panelLast.width / 2),
      y: panelFirst.top + panelFirst.height / 2 - (panelLast.top + panelLast.height / 2),
      scale: panelFirst.width / panelLast.width,
    });
    tl.to(panel, { x: 0, y: 0, scale: 1, duration: 0.8, ease: "power3.inOut", clearProps: "transform" }, 0.05);
  } else if (soil) {
    tl.fromTo(soil, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", clearProps: "opacity,transform" }, 0.75);
  }
  tl.eventCallback("onComplete", done);
  return tl;
}
