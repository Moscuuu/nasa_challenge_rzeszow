import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "../state/store";
import { isClick, ll2v, rotationFor, v2ll } from "./geo";
import { createHeatMaterial, maskTexture, scoreTexture } from "./heatMaterial";
import { Pulse } from "./Pulse";
import { useTextureSize } from "./useTextureSize";
import { ValidationBoxes } from "./ValidationBoxes";

export interface EarthGlobeHandle {
  /** Turn the globe so (lat, lon) faces the camera. */
  flyTo(lat: number, lon: number): void;
}

const IDLE_SPEED = 0.01; // rad/s, slow idle spin
const DRAG_SPEED = 0.005; // rad per px at the default zoom
const MAX_TILT = 1.4; // rad
const FOV = 35;
const MIN_DIST = 1.4;
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
  const showAll = useAppStore((s) => s.showAll);
  const focus = useAppStore((s) => s.focus);
  const checks = useAppStore((s) => s.checks);
  const validationOpen = useAppStore((s) => s.validationOpen);
  const clickEarth = useAppStore((s) => s.clickEarth);

  const globe = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Mesh>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const { width, height } = useThree((s) => s.size);

  // Heat overlay: one material, its uniforms follow the store.
  const heat = useMemo(createHeatMaterial, []);
  const scoreTex = useMemo(() => (scoreMap ? scoreTexture(scoreMap) : null), [scoreMap]);
  const maskTex = useMemo(() => (scoreMap ? maskTexture(scoreMap) : null), [scoreMap]);
  const threshold = useMemo(() => scoreMap?.topThreshold(TOP_FRACTION) ?? 1, [scoreMap]);
  useEffect(() => () => scoreTex?.dispose(), [scoreTex]);
  useEffect(() => () => maskTex?.dispose(), [maskTex]);
  useEffect(() => () => heat.dispose(), [heat]);
  useEffect(() => {
    heat.uniforms.uScore.value = scoreTex;
    heat.uniforms.uMask.value = maskTex;
    heat.uniforms.uThreshold.value = threshold;
  }, [heat, scoreTex, maskTex, threshold]);
  useEffect(() => {
    heat.uniforms.uShowAll.value = showAll ? 1 : 0;
  }, [heat, showAll]);
  useEffect(() => {
    // Reveal origin = focus cell. uReveal stays at PI (fully shown) until the timelines drive it.
    if (focus) heat.uniforms.uOrigin.value.copy(ll2v(focus.lat, focus.lon));
  }, [heat, focus]);

  const motion = useRef({
    vx: 0,
    vy: 0,
    dragging: false,
    target: null as { x: number; y: number } | null,
    hovered: false, // pointer is over the Earth slot
    fit: 4, // camera distance that frames the whole globe in the slot
    zoom: 1, // user zoom: camera distance = fit * zoom, kept within MIN_DIST..MAX_DIST
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

  useImperativeHandle(ref, () => ({ flyTo }));

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

    const pick = (x: number, y: number) => {
      const cam = camera.current;
      const mesh = earth.current;
      const g = globe.current;
      if (!cam || !mesh || !g) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit) return; // clicked space beside the globe
      const { lat, lon } = v2ll(g.worldToLocal(hit.point.clone()));
      clickEarth(lat, lon);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("button")) return;
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
      if (!pointers.has(e.pointerId)) return;
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

    // Zoom: ease the camera to the target distance.
    const dist = THREE.MathUtils.clamp(m.fit * m.zoom, MIN_DIST, MAX_DIST);
    const ease = reducedMotion() ? 1 : 1 - Math.exp(-10 * step);
    cam.position.z += (dist - cam.position.z) * ease;

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
    // Inertia after a drag, then the slow idle spin (paused while the user is on the globe).
    const decay = Math.exp(-3 * step);
    m.vx *= decay;
    m.vy *= decay;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + m.vx * step, -MAX_TILT, MAX_TILT);
    const idle = reducedMotion() || m.hovered ? 0 : IDLE_SPEED;
    g.rotation.y += (m.vy + idle) * step;
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.05} far={100} position={[0, 0, 4]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} />
      <group ref={globe} rotation-x={START.x} rotation-y={START.y}>
        <mesh ref={earth}>
          <sphereGeometry args={[1, 128, 96]} />
          <meshStandardMaterial map={texture} roughness={1} metalness={0} />
        </mesh>
        {/* Same SphereGeometry UVs as the satellite texture: both equirectangular, left edge 180°W. */}
        <mesh material={heat} renderOrder={1} visible={scoreTex !== null}>
          <sphereGeometry args={[HEAT_R, 128, 96]} />
        </mesh>
        {focus && <Pulse lat={focus.lat} lon={focus.lon} />}
        {validationOpen && <ValidationBoxes checks={checks} />}
      </group>
    </>
  );
});
