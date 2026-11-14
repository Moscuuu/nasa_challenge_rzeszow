import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CHECK_BOXES } from "../data/checkBoxes";
import type { ValidationCheck } from "../data/types";
import { ll2v } from "./geo";

const R = 1.004; // above heat overlay and pulse
const STEPS = 32; // segments per box edge, so edges follow the sphere

const solid = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, toneMapped: false });
const dashed = new THREE.LineDashedMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.9,
  dashSize: 0.008,
  gapSize: 0.006,
  toneMapped: false,
});

/** Box [lon0, lat0, lon1, lat1] as a closed polyline on the sphere. */
function boxPoints([lon0, lat0, lon1, lat1]: [number, number, number, number]): THREE.Vector3[] {
  const corners: Array<[number, number]> = [
    [lat0, lon0],
    [lat0, lon1],
    [lat1, lon1],
    [lat1, lon0],
  ];
  const pts: THREE.Vector3[] = [];
  for (let c = 0; c < 4; c++) {
    const [la, lo] = corners[c];
    const [lb, lob] = corners[(c + 1) % 4];
    for (let i = 0; i < STEPS; i++) {
      const t = i / STEPS;
      pts.push(ll2v(la + (lb - la) * t, lo + (lob - lo) * t, R));
    }
  }
  pts.push(pts[0].clone());
  return pts;
}

interface Props {
  checks: ValidationCheck[];
}

/** Validation check areas on Earth: known analogs solid, contrast areas dashed. */
export function ValidationBoxes({ checks }: Props) {
  const lines = useMemo(
    () =>
      checks.flatMap((check) => {
        if (check.applicable === false) return []; // R9: not drawn
        const box = check.bbox ?? CHECK_BOXES[check.name]; // R6
        if (!box) return [];
        const geometry = new THREE.BufferGeometry().setFromPoints(boxPoints(box));
        const line = new THREE.Line(geometry, check.role === "contrast" ? dashed : solid);
        if (check.role === "contrast") line.computeLineDistances();
        line.name = check.name;
        line.renderOrder = 3;
        return [line];
      }),
    [checks],
  );
  useEffect(() => () => lines.forEach((l) => l.geometry.dispose()), [lines]);

  return (
    <>
      {lines.map((line) => (
        <primitive key={line.name} object={line} />
      ))}
    </>
  );
}
