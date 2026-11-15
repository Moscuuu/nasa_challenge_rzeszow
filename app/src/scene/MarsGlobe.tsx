import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, PerspectiveCamera, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { appStore, useAppStore } from "../state/store";
import type { MarsSite } from "../data/types";
import { facesCamera, isClick, ll2v, nearestPin, rotationFor } from "./geo";
import { unitRing } from "./Pulse";
import { useTextureSize } from "./useTextureSize";

export interface MarsGlobeHandle {
  /** Turn the globe so (lat, lon) faces the camera. */
  rotateTo(lat: number, lon: number): void;
  /** Radar rings on the surface at (lat, lon); progress 0..1, null hides them. */
  radar(lat: number, lon: number, progress: number | null): void;
  /** Intro drivers: camera distance factor (1 = framed) and how far the pin flicker-in has got (0..1). */
  setIntro(v: { zoom?: number; pins?: number }): void;
}

const IDLE_SPEED = 0.015; // rad/s, slow idle spin
const DRAG_SPEED = 0.005; // rad per px
const MAX_TILT = 1.4; // rad
const FOV = 35;
const FLOAT_AMP = 0.025; // globe radii: a gentle drift, so the planet floats in space
const FLOAT_PERIOD = 7; // s
const PIN_R = 1.01;
const RADAR_RINGS = 3;
const RADAR_R = 1.004;
const RADAR_MAX = 0.5; // globe radii
const PICK_RADIUS = 28; // px: a click this close to a pin picks the nearest one

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Shortest signed angle from a to b. */
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Start facing the northern mid-latitude site cluster (Arcadia to Utopia), so pins show on load.
const UP = new THREE.Vector3(0, 0, 1);
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
  const picking = useAppStore((s) => s.stage === "pick");
  const selectSite = useAppStore((s) => s.selectSite);

  const globe = useRef<THREE.Group>(null);
  const float = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const motion = useRef({
    vx: 0,
    vy: 0,
    dragging: false,
    target: null as { x: number; y: number } | null,
    pinFocused: false, // a pin button has keyboard/pointer focus
    hovered: false, // pointer is over the Mars slot
  });
  const { width, height } = useThree((s) => s.size);
  // Latest size for fit(): the timelines hold on to the first handle object, so its closures go stale.
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const getThree = useThree((s) => s.get);
  const intro = useRef({ zoom: 1, pins: 1 });
  const radarRef = useRef<{ lat: number; lon: number; p: number | null }>({ lat: 0, lon: 0, p: null });
  const radarGroup = useRef<THREE.Group>(null);
  const radarRings = useRef<Array<THREE.LineLoop | null>>([]);
  const radarMats = useMemo(
    () =>
      Array.from(
        { length: RADAR_RINGS },
        () => new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, toneMapped: false }),
      ),
    [],
  );
  useEffect(() => () => radarMats.forEach((m) => m.dispose()), [radarMats]);

  const rotateTo = (lat: number, lon: number) => {
    const t = rotationFor(lat, lon);
    const g = globe.current;
    if (g && reducedMotion()) {
      g.rotation.set(t.x, t.y, 0);
      return;
    }
    Object.assign(motion.current, { target: t, vx: 0, vy: 0 });
  };

  useImperativeHandle(ref, () => ({
    rotateTo,
    radar(lat, lon, progress) {
      const r = radarRef.current;
      r.lat = lat;
      r.lon = lon;
      r.p = progress;
      const g = radarGroup.current;
      if (g && progress !== null) {
        const pos = ll2v(lat, lon, RADAR_R);
        g.position.copy(pos);
        g.quaternion.setFromUnitVectors(UP, pos.clone().normalize());
      }
    },
    setIntro(v) {
      Object.assign(intro.current, v);
      fit();
    },
  }));

  // Drag to rotate, and pick the pin nearest the pointer. The pin buttons overlap on the small
  // globe, so mouse clicks never go to a button: they are routed here by screen distance.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const m = motion.current;
    let last = { x: 0, y: 0 };
    let down: { x: number; y: number } | null = null;
    /** Visible pins in screen space (client px). */
    const screenPins = () => {
      const g = globe.current;
      const { camera } = getThree();
      if (!g || intro.current.pins < 1) return [];
      const rect = el.getBoundingClientRect(); // the Mars view fills its slot
      g.updateWorldMatrix(true, false);
      const v = new THREE.Vector3();
      const out: Array<{ id: string; x: number; y: number }> = [];
      for (const site of appStore.getState().sites) {
        v.copy(ll2v(site.lat, site.lon, PIN_R)).applyMatrix4(g.matrixWorld);
        if (!facesCamera(v, camera)) continue;
        v.project(camera);
        out.push({ id: site.id, x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (0.5 - v.y * 0.5) * rect.height });
      }
      return out;
    };
    const nearest = (e: PointerEvent) => nearestPin({ x: e.clientX, y: e.clientY }, screenPins(), PICK_RADIUS);
    let hot: string | null = null;
    const setHot = (id: string | null) => {
      if (id === hot) return;
      hot = id;
      el.style.cursor = id ? "pointer" : "";
      el.querySelectorAll<HTMLElement>("button.pin").forEach((b) => b.classList.toggle("pin--hot", b.dataset.site === id));
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("[data-ui]")) return; // panel heading, site dropdown
      down = last = { x: e.clientX, y: e.clientY };
      m.dragging = true;
      m.target = null;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!m.dragging) setHot(nearest(e));
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
      if (down && isClick(down, { x: e.clientX, y: e.clientY })) {
        m.vx = m.vy = 0;
        const id = nearest(e);
        if (id && appStore.getState().stage !== "depth") void appStore.getState().selectSite(id);
      }
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onEnter = () => (m.hovered = true);
    const onLeave = () => {
      m.hovered = false;
      setHot(null);
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.style.touchAction = "none";
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [slot, getThree]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the globe (radius 1, with margin) in the slot whatever its aspect.
  const fit = () => {
    const cam = camera.current;
    const { width: w, height: h } = sizeRef.current;
    if (!cam || !w || !h) return;
    const aspect = w / h;
    const d = 1.3 / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.min(1, aspect));
    cam.position.set(0, 0, d * intro.current.zoom);
  };
  useEffect(fit, [width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }, dt) => {
    if (float.current && !reducedMotion()) {
      const t = (clock.elapsedTime / FLOAT_PERIOD) * Math.PI * 2 + 0;
      float.current.position.set(Math.cos(t * 0.5) * FLOAT_AMP * 0.4, Math.sin(t) * FLOAT_AMP, 0);
    }
    const g = globe.current;
    if (!g) return;
    const m = motion.current;
    const step = Math.min(dt, 0.1);
    // Radar rings: staggered expanding 1 px circles, hidden when progress is null.
    const rg = radarGroup.current;
    const rp = radarRef.current.p;
    if (rg) {
      rg.visible = rp !== null;
      radarRings.current.forEach((ring, i) => {
        if (!ring || rp === null) return;
        const ph = THREE.MathUtils.clamp((rp * (1 + (RADAR_RINGS - 1) * 0.3) - i * 0.3), 0, 1);
        const sc = RADAR_MAX * (0.05 + 0.95 * ph);
        ring.scale.set(sc, sc, 1);
        radarMats[i].opacity = 0.9 * (1 - ph) * Math.min(1, ph * 6);
      });
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
    // Inertia after a drag, then the slow idle spin (paused while the user is on the globe).
    const decay = Math.exp(-3 * step);
    m.vx *= decay;
    m.vy *= decay;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + m.vx * step, -MAX_TILT, MAX_TILT);
    const idle = reducedMotion() || m.pinFocused || m.hovered ? 0 : IDLE_SPEED;
    g.rotation.y += (m.vy + idle) * step;
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.1} far={100} position={[0, 0, 5]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} />
      <group ref={float}>
        <group ref={globe} rotation-x={START.x} rotation-y={START.y}>
          <mesh>
            <sphereGeometry args={[1, 96, 64]} />
            <meshStandardMaterial map={texture} roughness={1} metalness={0} />
          </mesh>
          <group ref={radarGroup} visible={false}>
            {radarMats.map((mat, i) => (
              <lineLoop
                key={i}
                ref={(el: THREE.LineLoop | null) => (radarRings.current[i] = el)}
                geometry={unitRing}
                material={mat}
                renderOrder={2}
              />
            ))}
          </group>
          {sites.map((site, idx) => (
            <Pin
              key={site.id}
              site={site}
              index={idx}
              count={sites.length}
              intro={intro}
              selected={site.id === siteId}
              pulse={picking}
              slot={slot}
              onSelect={() => {
                if (appStore.getState().stage !== "depth") void selectSite(site.id); // depth step: site is locked
              }}
              onFocusChange={(focused) => {
                motion.current.pinFocused = focused;
                if (focused) rotateTo(site.lat, site.lon);
              }}
            />
          ))}
        </group>
      </group>
    </>
  );
});

const ringGeometry = new THREE.RingGeometry(0.022, 0.03, 40);
const dotGeometry = new THREE.CircleGeometry(0.03, 40);
const pinMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide });
const PULSE_PERIOD = 1.8; // s
const PULSE_GROW = 3.2; // ring scale at the end of a beat

interface PinProps {
  site: MarsSite;
  index: number;
  count: number;
  intro: MutableRefObject<{ zoom: number; pins: number }>;
  selected: boolean;
  /** Pick step: a ring beats outward from the pin, so the sites read as clickable. */
  pulse: boolean;
  slot: MutableRefObject<HTMLElement>;
  onSelect(): void;
  onFocusChange(focused: boolean): void;
}

function Pin({ site, index, count, intro, selected, pulse, slot, onSelect, onFocusChange }: PinProps) {
  const position = useMemo(() => ll2v(site.lat, site.lon, PIN_R), [site.lat, site.lon]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, position.clone().normalize()),
    [position],
  );
  const button = useRef<HTMLButtonElement>(null);
  const group = useRef<THREE.Group>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const beat = useRef<THREE.Mesh>(null);
  const beatMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  useEffect(() => () => beatMaterial.dispose(), [beatMaterial]);

  // Hide far-side pins. Their buttons stay in the Tab order (faded, not clickable);
  // focusing one turns the globe to bring it to the front.
  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    const r = beat.current;
    if (r) {
      // Beats start only once every pin is in (after the intro flicker); staggered per site.
      r.visible = pulse && intro.current.pins >= 1 && !reducedMotion();
      if (r.visible) {
        const ph = (clock.elapsedTime / PULSE_PERIOD + index * 0.37) % 1;
        const sc = 1 + (PULSE_GROW - 1) * (1 - (1 - ph) ** 2);
        r.scale.set(sc, sc, 1);
        beatMaterial.opacity = 0.85 * (1 - ph);
      }
    }
    g.getWorldPosition(world);
    // Intro: pins flicker in one after another (pins 0..1 spreads the sites over the timeline).
    const local = intro.current.pins * count - index;
    const shown = local >= 1 || (local > 0 && Math.sin(local * 50) > 0);
    const visible = shown && facesCamera(world, camera);
    g.visible = visible;
    // Synced every frame (not only on change): Html may swap the button node on re-render.
    const b = button.current;
    if (b && b.classList.contains("pin--far") === visible) b.classList.toggle("pin--far", !visible);
  });

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh geometry={selected ? dotGeometry : ringGeometry} material={pinMaterial} />
      <mesh ref={beat} geometry={ringGeometry} material={beatMaterial} visible={false} renderOrder={2} />
      <Html center portal={slot} zIndexRange={[20, 10]}>
        <button
          ref={button}
          type="button"
          className="pin"
          aria-label={site.name}
          aria-pressed={selected}
          data-site={site.id}
          onClick={(e) => {
            if (e.detail === 0) onSelect(); // keyboard / assistive tech; pointer clicks are routed by the slot
          }}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
        >
          <span className="pin-label" aria-hidden="true">
            {site.name}
          </span>
        </button>
      </Html>
    </group>
  );
}
