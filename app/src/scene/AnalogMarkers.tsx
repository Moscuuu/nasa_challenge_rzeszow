import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AnalogPoint, AnalogRegion } from "../data/regions";
import { facesCamera, ll2v, slotCalculatePosition } from "./geo";

/** Camera distance below which the globe counts as zoomed in: region pins give way to point pins. */
export const ZOOM_IN_DIST = 2.4;
const PIN_R = 1.01;
const AREA_R = 1.004;
const UP = new THREE.Vector3(0, 0, 1);
const GOLD = "#ffcf4a";
const DETAIL_COLOR = "#ffe600"; // yellow: the region's detailed area (its analog cells)
const DETAIL_OPACITY = 0.85; // stronger than the region glow
const DETAIL_R = 1.005; // just above the region glow (AREA_R)
const DETAIL_DISC_DEG = 0.45; // disc radius per analog cell: a 0.1 deg cell would be invisible from afar

// Soft radial glow, shared by every region area.
const glowTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,207,74,0.55)");
  g.addColorStop(0.7, "rgba(255,207,74,0.30)");
  g.addColorStop(1, "rgba(255,207,74,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
// Detailed area: near-opaque white centre (tinted yellow by the material), soft edge so discs blend.
const detailTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const discGeometry = new THREE.CircleGeometry(1, 64);
const ringGeometry = (() => {
  const g = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    }),
  );
  return g;
})();

const isZoomed = (camera: THREE.Camera, v: THREE.Vector3) => camera.getWorldPosition(v).length() < ZOOM_IN_DIST;

function surface(lat: number, lon: number, r: number) {
  const position = ll2v(lat, lon, r);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, position.clone().normalize());
  return { position, quaternion };
}

/** Glowing area + dashed outline around a region's analogs. The glow fades when zoomed in. */
function RegionArea({ region }: { region: AnalogRegion }) {
  const { position, quaternion } = useMemo(() => surface(region.lat, region.lon, AREA_R), [region.lat, region.lon]);
  const r = THREE.MathUtils.degToRad(region.radiusDeg);
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const line = useMemo(() => {
    const m = new THREE.LineDashedMaterial({ color: GOLD, dashSize: 0.05, gapSize: 0.035, transparent: true, depthWrite: false, toneMapped: false });
    const l = new THREE.Line(ringGeometry, m);
    l.computeLineDistances();
    return l;
  }, []);
  useEffect(() => () => {
    glow.dispose();
    (line.material as THREE.Material).dispose();
  }, [glow, line]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const zoomed = isZoomed(camera, v);
    glow.opacity = THREE.MathUtils.lerp(glow.opacity, zoomed ? 0.25 : 1, 0.15);
    (line.material as THREE.LineDashedMaterial).opacity = zoomed ? 0.9 : 0.75;
  });
  return (
    <group position={position} quaternion={quaternion} scale={[r, r, 1]}>
      <mesh geometry={discGeometry} material={glow} renderOrder={2} scale={1.25} />
      <primitive object={line} renderOrder={3} />
    </group>
  );
}

interface PinProps {
  lat: number;
  lon: number;
  slot: MutableRefObject<HTMLElement>;
  /** Region pins show while zoomed out, point pins while zoomed in. */
  kind: "region" | "point";
  className?: string;
  label: string;
  onClick(): void;
  children: React.ReactNode;
}

function Pin({ lat, lon, slot, kind, className, label, onClick, children }: PinProps) {
  const position = useMemo(() => ll2v(lat, lon, PIN_R), [lat, lon]);
  const group = useRef<THREE.Group>(null);
  const button = useRef<HTMLButtonElement>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const calc = useMemo(() => slotCalculatePosition(slot), [slot]);
  const cam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = group.current;
    const b = button.current;
    if (!g || !b) return;
    g.getWorldPosition(world);
    const show = (kind === "region" || isZoomed(camera, cam)) && facesCamera(world, camera);
    if (b.classList.contains("apin--hidden") === show) b.classList.toggle("apin--hidden", !show);
  });
  return (
    <group ref={group} position={position}>
      <Html center portal={slot} calculatePosition={calc} zIndexRange={[30, 20]}>
        <button ref={button} type="button" className={`apin apin--${kind} apin--hidden ${className ?? ""}`} aria-label={label} onClick={onClick}>
          {children}
        </button>
      </Html>
    </group>
  );
}

/** The region's detailed area: one soft disc per analog cell it holds, brighter yellow than the region glow. */
function DetailArea({ points }: { points: AnalogPoint[] }) {
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: detailTexture, color: DETAIL_COLOR, transparent: true, opacity: DETAIL_OPACITY,
                                        depthWrite: false, toneMapped: false }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const discs = useMemo(
    () => points.map((p) => ({ id: p.cell.id, ...surface(p.cell.lat, p.cell.lon, DETAIL_R) })),
    [points],
  );
  const r = THREE.MathUtils.degToRad(DETAIL_DISC_DEG);
  return (
    <>
      {discs.map((d) => (
        <mesh key={d.id} geometry={discGeometry} material={material} position={d.position} quaternion={d.quaternion}
              scale={[r, r, 1]} renderOrder={4} />
      ))}
    </>
  );
}

interface Props {
  regions: AnalogRegion[];
  slot: MutableRefObject<HTMLElement>;
  onRegion(region: AnalogRegion): void;
}

/**
 * One pin per analog region (its best match; a click opens that match) over the region's reach (gold glow
 * and dashed ring) and its detailed area (yellow, stronger: the region's analog cells).
 */
export function AnalogMarkers({ regions, slot, onRegion }: Props) {
  return (
    <>
      {regions.map((r) => (
        <group key={r.id}>
          <RegionArea region={r} />
          <DetailArea points={r.points} />
          <Pin
            lat={r.lat}
            lon={r.lon}
            slot={slot}
            kind="region"
            label={`#${r.rank} ${r.name}: best match ${Math.round(r.best * 100)}%${r.points.length > 1 ? `, ${r.points.length} analog cells` : ""}`}
            onClick={() => onRegion(r)}
          >
            <span className="apin-head"><i>{r.rank}</i></span>
            <span className="apin-chip">
              {r.name}
              {r.points.length > 1 && <b> ×{r.points.length}</b>}
            </span>
          </Pin>
        </group>
      ))}
    </>
  );
}
