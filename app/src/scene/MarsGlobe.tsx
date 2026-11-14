import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, PerspectiveCamera, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "../state/store";
import type { MarsSite } from "../data/types";
import { facesCamera, isClick, ll2v } from "./geo";
import { useTextureSize } from "./useTextureSize";

export interface MarsGlobeHandle {
  /** Turn the globe so (lat, lon) faces the camera. */
  rotateTo(lat: number, lon: number): void;
}

const IDLE_SPEED = 0.015; // rad/s, slow idle spin
const DRAG_SPEED = 0.005; // rad per px
const MAX_TILT = 1.4; // rad
const FOV = 35;
const PIN_R = 1.01;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Shortest signed angle from a to b. */
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Globe rotation (Euler XYZ) that brings (lat, lon) to face a camera on +z. */
export function rotationFor(lat: number, lon: number): { x: number; y: number } {
  const p = ll2v(lat, lon);
  return { x: THREE.MathUtils.degToRad(lat), y: -Math.atan2(p.x, p.z) };
}

// Start facing the northern mid-latitude site cluster (Arcadia to Utopia), so pins show on load.
const START = rotationFor(25, 165);

interface Props {
  /** DOM element that receives drag gestures and hosts the pin buttons. */
  slot: MutableRefObject<HTMLElement>;
}

export const MarsGlobe = forwardRef<MarsGlobeHandle, Props>(function MarsGlobe({ slot }, ref) {
  const size = useTextureSize();
  const texture = useTexture(`${import.meta.env.BASE_URL}textures/mars_color_${size}.jpg`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const sites = useAppStore((s) => s.sites);
  const siteId = useAppStore((s) => s.siteId);
  const selectSite = useAppStore((s) => s.selectSite);

  const globe = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const motion = useRef({
    vx: 0,
    vy: 0,
    dragging: false,
    target: null as { x: number; y: number } | null,
  });
  const { width, height } = useThree((s) => s.size);

  useImperativeHandle(ref, () => ({
    rotateTo(lat, lon) {
      const t = rotationFor(lat, lon);
      const g = globe.current;
      if (g && reducedMotion()) {
        g.rotation.set(t.x, t.y, 0);
        return;
      }
      Object.assign(motion.current, { target: t, vx: 0, vy: 0 });
    },
  }));

  // Drag to rotate, on the whole slot. Pin buttons keep their own clicks.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const m = motion.current;
    let last = { x: 0, y: 0 };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("button")) return;
      down = last = { x: e.clientX, y: e.clientY };
      m.dragging = true;
      m.target = null;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!m.dragging || !globe.current) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      const g = globe.current.rotation;
      g.y += dx * DRAG_SPEED;
      g.x = THREE.MathUtils.clamp(g.x + dy * DRAG_SPEED, -MAX_TILT, MAX_TILT);
      m.vx = dy * DRAG_SPEED * 60;
      m.vy = dx * DRAG_SPEED * 60;
    };
    const onUp = (e: PointerEvent) => {
      if (!m.dragging) return;
      m.dragging = false;
      if (down && isClick(down, { x: e.clientX, y: e.clientY })) m.vx = m.vy = 0;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.style.touchAction = "none";
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [slot]);

  // Fit the globe (radius 1, with margin) in the slot whatever its aspect.
  useEffect(() => {
    const cam = camera.current;
    if (!cam || !width || !height) return;
    const aspect = width / height;
    cam.position.set(0, 0, 1.3 / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.min(1, aspect)));
  }, [width, height]);

  useFrame((_, dt) => {
    const g = globe.current;
    if (!g) return;
    const m = motion.current;
    const step = Math.min(dt, 0.1);
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
    // Inertia after a drag, then the slow idle spin.
    const decay = Math.exp(-3 * step);
    m.vx *= decay;
    m.vy *= decay;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + m.vx * step, -MAX_TILT, MAX_TILT);
    g.rotation.y += (m.vy + (reducedMotion() ? 0 : IDLE_SPEED)) * step;
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.1} far={100} position={[0, 0, 5]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} />
      <group ref={globe} rotation-x={START.x} rotation-y={START.y}>
        <mesh>
          <sphereGeometry args={[1, 96, 64]} />
          <meshStandardMaterial map={texture} roughness={1} metalness={0} />
        </mesh>
        {sites.map((site) => (
          <Pin
            key={site.id}
            site={site}
            selected={site.id === siteId}
            slot={slot}
            onSelect={() => void selectSite(site.id)}
          />
        ))}
      </group>
    </>
  );
});

const UP = new THREE.Vector3(0, 0, 1);
const ringGeometry = new THREE.RingGeometry(0.022, 0.03, 40);
const dotGeometry = new THREE.CircleGeometry(0.03, 40);
const pinMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide });

interface PinProps {
  site: MarsSite;
  selected: boolean;
  slot: MutableRefObject<HTMLElement>;
  onSelect(): void;
}

function Pin({ site, selected, slot, onSelect }: PinProps) {
  const position = useMemo(() => ll2v(site.lat, site.lon, PIN_R), [site.lat, site.lon]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, position.clone().normalize()),
    [position],
  );
  const button = useRef<HTMLButtonElement>(null);
  const group = useRef<THREE.Group>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const shown = useRef(true);

  // Hide the pin and its button on the far side of the globe.
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(world);
    const visible = facesCamera(world, camera);
    if (visible === shown.current) return;
    shown.current = visible;
    g.visible = visible;
    const b = button.current;
    if (b) {
      b.style.visibility = visible ? "visible" : "hidden";
      b.tabIndex = visible ? 0 : -1;
      if (!visible && document.activeElement === b) b.blur();
    }
  });

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh geometry={selected ? dotGeometry : ringGeometry} material={pinMaterial} />
      <Html center portal={slot} zIndexRange={[20, 10]}>
        <button
          ref={button}
          type="button"
          className="pin"
          aria-label={site.name}
          aria-pressed={selected}
          onClick={onSelect}
        >
          <span className="pin-label" aria-hidden="true">
            {site.name}
          </span>
        </button>
      </Html>
    </group>
  );
}
