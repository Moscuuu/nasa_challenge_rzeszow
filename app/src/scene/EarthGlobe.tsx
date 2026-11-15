import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "../state/store";
import { isClick, ll2v, rotationFor, v2ll } from "./geo";
import { PULSE_RADIUS } from "./heat";
import { createHeatMaterial, scoreTexture } from "./heatMaterial";
import { Pulse } from "./Pulse";
import { motion as motionRegistry } from "../motion/registry";
import { useTextureSize } from "./useTextureSize";
import { ValidationBoxes } from "./ValidationBoxes";
import { AnalogMarkers, ZOOM_IN_DIST } from "./AnalogMarkers";
import { analogRegions, type AnalogRegion } from "../data/regions";
import { distDeg } from "../data/cells";

/** A click within this share of a region's radius (plus a few degrees) counts as a click on the region. */
const REGION_HIT_SCALE = 1.35;
const REGION_HIT_PAD_DEG = 2.5;

export interface EarthGlobeHandle {
  /** Turn the globe so (lat, lon) faces the camera. */
  flyTo(lat: number, lon: number): void;
  /** Heat reveal radius from the focus cell, in radians (0 = hidden, PI = all shown). */
  setReveal(radians: number): void;
  /** Show or hide the pulse rings on the focus cell. */
  setPulseVisible(visible: boolean): void;
  /** Intro: globe scale 0..1 (rises into view). */
  setIntro(v: { scale?: number }): void;
  /** Back to the whole globe after zooming into a region. */
  zoomOut(): void;
}

const IDLE_SPEED = 0.01; // rad/s, slow idle spin
const DRAG_SPEED = 0.005; // rad per px at the default zoom
const MAX_TILT = 1.4; // rad
const FOV = 35;
const FLOAT_AMP = 0.02; // globe radii: a gentle drift, so the planet floats in space
const FLOAT_PERIOD = 9; // s
const MIN_DIST = 1.2;
const MAX_DIST = 6;
const HEAT_R = 1.002;
const TOP_FRACTION = 0.1; // heat map shows the top 10 % of permafrost pixels

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Shortest signed angle from a to b. */
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Start facing the northern permafrost belt (Siberia side).
const START = rotationFor(55, 120);

interface Props {
  /** DOM element that receives drag, zoom and click gestures. */
  slot: MutableRefObject<HTMLElement>;
}

export const EarthGlobe = forwardRef<EarthGlobeHandle, Props>(function EarthGlobe({ slot }, ref) {
  const size = useTextureSize();
  const texture = useTexture(`${import.meta.env.BASE_URL}textures/earth_color_${size}.jpg`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const scoreMap = useAppStore((s) => s.scoreMap);
  const focus = useAppStore((s) => s.focus);
  const checks = useAppStore((s) => s.checks);
  const validationOpen = useAppStore((s) => s.validationOpen);
  const clickEarth = useAppStore((s) => s.clickEarth);
  const cells = useAppStore((s) => s.cells);
  const siteId = useAppStore((s) => s.siteId);
  const regions = useMemo(() => analogRegions(cells, siteId), [cells, siteId]);
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const zoomToRegionRef = useRef<(r: AnalogRegion) => void>(() => {});

  const globe = useRef<THREE.Group>(null);
  const float = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const pulseGroup = useRef<THREE.Group>(null);
  const { width, height } = useThree((s) => s.size);

  // Heat overlay: one material, its uniforms follow the store.
  const heat = useMemo(createHeatMaterial, []);
  const threshold = useMemo(() => scoreMap?.topThreshold(TOP_FRACTION) ?? 1, [scoreMap]);
  const scoreTex = useMemo(() => (scoreMap ? scoreTexture(scoreMap, threshold) : null), [scoreMap, threshold]);
  useEffect(() => () => scoreTex?.dispose(), [scoreTex]);
  useEffect(() => () => heat.dispose(), [heat]);
  useEffect(() => {
    heat.uniforms.uScore.value = scoreTex;
  }, [heat, scoreTex]);
  useEffect(() => {
    // Reveal origin = focus cell. uReveal stays at PI (fully shown) until the timelines drive it.
    // Heat under the pulse rings is thinned so they stay visible.
    if (focus) heat.uniforms.uOrigin.value.copy(ll2v(focus.lat, focus.lon));
    heat.uniforms.uPulseRadius.value = focus ? PULSE_RADIUS : 0;
  }, [heat, focus]);

  const motion = useRef({
    vx: 0,
    vy: 0,
    dragging: false,
    target: null as { x: number; y: number } | null,
    hovered: false, // pointer is over the Earth slot
    fit: 4, // camera distance that frames the whole globe in the slot
    zoom: 1, // user zoom: camera distance = fit * zoom, kept within MIN_DIST..MAX_DIST
    floatT: 0, // float drift clock; paused while zoomed in so the view holds still
  });

  const flyTo = (lat: number, lon: number) => {
    const t = rotationFor(lat, lon);
    const g = globe.current;
    if (g && reducedMotion()) {
      g.rotation.set(t.x, t.y, 0);
      return;
    }
    Object.assign(motion.current, { target: t, vx: 0, vy: 0 });
  };

  useImperativeHandle(ref, () => ({
    flyTo,
    setReveal(radians) {
      heat.uniforms.uReveal.value = radians;
    },
    setPulseVisible(visible) {
      if (pulseGroup.current) pulseGroup.current.visible = visible;
    },
    setIntro({ scale }) {
      if (scale !== undefined) globe.current?.scale.setScalar(Math.max(scale, 0.0001));
    },
    zoomOut() {
      setZoom(1);
    },
  }));

  // Region pin: turn to the region and zoom in until its analog points show.
  const zoomToRegion = (r: AnalogRegion) => {
    flyTo(r.lat, r.lon);
    const dist = THREE.MathUtils.clamp(1.25 + THREE.MathUtils.degToRad(r.radiusDeg) * 4, 1.5, ZOOM_IN_DIST - 0.2);
    setZoom(dist / motion.current.fit);
  };
  zoomToRegionRef.current = zoomToRegion;

  // The globe follows the focus cell (step, layer change, check highlight). A site pick holds this
  // until the Mars rings finish; its timeline then flies the globe itself. Clicking a point on the
  // globe never changes focus, so stepping through matches turns the globe even while zoomed in.
  useEffect(() => {
    if (focus && !motionRegistry.holdFly) flyTo(focus.lat, focus.lon);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const setZoom = (zoom: number) => {
    const m = motion.current;
    m.zoom = THREE.MathUtils.clamp(zoom, MIN_DIST / m.fit, MAX_DIST / m.fit);
  };

  // Gestures on the whole slot: drag rotates, wheel / pinch zooms, a click (< 6 px) picks a point.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const m = motion.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let last = { x: 0, y: 0 };
    let down: { x: number; y: number } | null = null;
    let pinch: { dist: number; zoom: number } | null = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const raycaster = new THREE.Raycaster();

    /** Globe point under the pointer, or null over empty space. */
    const pointAt = (x: number, y: number) => {
      const cam = camera.current;
      const mesh = earth.current;
      const g = globe.current;
      if (!cam || !mesh || !g) return null;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);
      const hit = raycaster.intersectObject(mesh, false)[0];
      return hit ? v2ll(g.worldToLocal(hit.point.clone())) : null;
    };
    /** Zoomed out: the region whose area contains the point (nearest centre wins). */
    const regionAt = (lat: number, lon: number): AnalogRegion | null => {
      const cam = camera.current;
      if (!cam || cam.position.z < ZOOM_IN_DIST) return null;
      let best: AnalogRegion | null = null;
      let bestD = Infinity;
      for (const r of regionsRef.current) {
        const d = distDeg(lat, lon, r.lat, r.lon);
        if (d <= r.radiusDeg * REGION_HIT_SCALE + REGION_HIT_PAD_DEG && d < bestD) [best, bestD] = [r, d];
      }
      return best;
    };
    const pick = (x: number, y: number) => {
      const p = pointAt(x, y);
      if (!p) return; // clicked space beside the globe
      const region = regionAt(p.lat, p.lon);
      if (region) zoomToRegionRef.current(region);
      else clickEarth(p.lat, p.lon);
    };
    const hover = (x: number, y: number) => {
      const p = pointAt(x, y);
      el.style.cursor = p && regionAt(p.lat, p.lon) ? "pointer" : "";
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("button, [data-ui]")) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      m.target = null;
      if (pointers.size === 2) {
        pinch = { dist: spread(), zoom: m.zoom };
        m.dragging = false;
        down = null; // a pinch is never a click
        return;
      }
      down = last = { x: e.clientX, y: e.clientY };
      m.dragging = true;
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === "mouse" && (e.target as Element).closest?.("button, [data-ui]") === null) hover(e.clientX, e.clientY);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        setZoom((pinch.zoom * pinch.dist) / Math.max(1, spread()));
        return;
      }
      if (!m.dragging || !globe.current) return;
      const k = DRAG_SPEED * m.zoom; // slower when zoomed in
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      const g = globe.current.rotation;
      g.y += dx * k;
      g.x = THREE.MathUtils.clamp(g.x + dy * k, -MAX_TILT, MAX_TILT);
      m.vx = dy * k * 60;
      m.vy = dx * k * 60;
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (pinch) {
        if (pointers.size === 0) pinch = null;
        return;
      }
      if (!m.dragging) return;
      m.dragging = false;
      if (e.type === "pointerup" && down && isClick(down, { x: e.clientX, y: e.clientY })) {
        m.vx = m.vy = 0;
        pick(e.clientX, e.clientY);
      }
      down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(m.zoom * Math.exp(e.deltaY * 0.001));
    };
    const onEnter = () => (m.hovered = true);
    const onLeave = () => (m.hovered = false);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.style.touchAction = "none";
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [slot, clickEarth]);

  // Fit the globe (radius 1, small margin) in the slot whatever its aspect.
  useEffect(() => {
    if (!width || !height) return;
    const m = motion.current;
    m.fit = 1.12 / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.min(1, width / height));
    setZoom(m.zoom);
  }, [width, height]);

  useFrame((_, dt) => {
    const g = globe.current;
    const cam = camera.current;
    if (!g || !cam) return;
    const m = motion.current;
    const step = Math.min(dt, 0.1);
    const close = cam.position.z < ZOOM_IN_DIST;
    if (float.current && !reducedMotion()) {
      if (!close) m.floatT += step;
      const t = (m.floatT / FLOAT_PERIOD) * Math.PI * 2 + 1.7;
      float.current.position.set(Math.cos(t * 0.5) * FLOAT_AMP * 0.4, Math.sin(t) * FLOAT_AMP, 0);
    }

    // Zoom: ease the camera to the target distance.
    const dist = THREE.MathUtils.clamp(m.fit * m.zoom, MIN_DIST, MAX_DIST);
    const ease = reducedMotion() ? 1 : 1 - Math.exp(-10 * step);
    cam.position.z += (dist - cam.position.z) * ease;
    // Lets the DOM show the "back to whole Earth" button while zoomed in.
    const zoomedIn = cam.position.z < ZOOM_IN_DIST;
    const el = slot.current;
    if (el && (el.dataset.zoomed !== undefined) !== zoomedIn) {
      if (zoomedIn) el.dataset.zoomed = "";
      else delete el.dataset.zoomed;
    }

    if (m.dragging) return;
    if (m.target) {
      const k = 1 - Math.exp(-4 * step); // eased approach
      const dy = angleDelta(g.rotation.y, m.target.y);
      const dx = m.target.x - g.rotation.x;
      g.rotation.y += dy * k;
      g.rotation.x += dx * k;
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) m.target = null;
      return;
    }
    // Inertia after a drag, then the slow idle spin (paused while the user is on the globe or zoomed in).
    const decay = Math.exp(-3 * step);
    m.vx *= decay;
    m.vy *= decay;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + m.vx * step, -MAX_TILT, MAX_TILT);
    const idle = reducedMotion() || m.hovered || close ? 0 : IDLE_SPEED;
    g.rotation.y += (m.vy + idle) * step;
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.05} far={100} position={[0, 0, 4]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} />
      <group ref={float}>
        <group ref={globe} rotation-x={START.x} rotation-y={START.y}>
          <mesh ref={earth}>
            <sphereGeometry args={[1, 128, 96]} />
            <meshStandardMaterial map={texture} roughness={1} metalness={0} />
          </mesh>
          {/* Same SphereGeometry UVs as the satellite texture: both equirectangular, left edge 180°W. */}
          {/* Heat glow retired in favour of the region markers; kept mounted for the reveal timelines. */}
          <mesh material={heat} renderOrder={1} visible={false}>
            <sphereGeometry args={[HEAT_R, 128, 96]} />
          </mesh>
          <group ref={pulseGroup}>{focus && <Pulse lat={focus.lat} lon={focus.lon} />}</group>
          {validationOpen && <ValidationBoxes checks={checks} />}
          <AnalogMarkers
            regions={regions}
            slot={slot}
            onRegion={zoomToRegion}
            onPoint={(p) => clickEarth(p.cell.lat, p.cell.lon)}
          />
        </group>
      </group>
    </>
  );
});
