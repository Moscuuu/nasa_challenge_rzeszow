import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ll2v } from "./geo";
import { PULSE_RADIUS } from "./heat";

const RINGS = 3;
const PERIOD = 2.4; // s per ring sweep; rings start PERIOD / RINGS apart
const MAX_RADIUS = PULSE_RADIUS; // globe radii; the heat shader thins heat inside it
const R = 1.003; // just above the heat overlay (1.002)
const UP = new THREE.Vector3(0, 0, 1);
// Unit circle as a 1 px line loop (stays 1 px at any zoom), scaled per frame.
export const unitRing = new THREE.BufferGeometry().setFromPoints(
  Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  }),
);

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

interface Props {
  lat: number;
  lon: number;
}

/** Three thin white rings sweeping out from (lat, lon), staggered. Static with reduced motion. */
export function Pulse({ lat, lon }: Props) {
  const position = useMemo(() => ll2v(lat, lon, R), [lat, lon]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, position.clone().normalize()),
    [position],
  );
  const materials = useMemo(
    () =>
      Array.from(
        { length: RINGS },
        () =>
          new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, toneMapped: false }),
      ),
    [],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const rings = useRef<Array<THREE.LineLoop | null>>([]);

  useFrame(({ clock }) => {
    const still = reducedMotion();
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      // Reduced motion: three fixed concentric rings.
      const phase = still ? (i + 1) / (RINGS + 0.5) : (clock.elapsedTime / PERIOD + i / RINGS) % 1;
      const s = MAX_RADIUS * (0.08 + 0.92 * phase);
      ring.scale.set(s, s, 1);
      materials[i].opacity = still ? 0.6 : 0.9 * (1 - phase) * Math.min(1, phase * 6);
    });
  });

  return (
    <group position={position} quaternion={quaternion}>
      {materials.map((m, i) => (
        <lineLoop
          key={i}
          ref={(el: THREE.LineLoop | null) => (rings.current[i] = el)}
          geometry={unitRing}
          material={m}
          renderOrder={2}
        />
      ))}
    </group>
  );
}
