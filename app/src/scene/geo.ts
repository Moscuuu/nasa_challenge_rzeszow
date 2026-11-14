import * as THREE from "three";

/** Lat/lon (degrees) to a point on a sphere of radius r. Matches SphereGeometry UVs. */
export function ll2v(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(th),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(th),
  );
}

/** Point on a sphere (any radius) back to lat/lon in degrees. Inverse of ll2v. */
export function v2ll(v: THREE.Vector3): { lat: number; lon: number } {
  const n = v.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(n.y));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

/** Globe rotation (Euler XYZ) that brings (lat, lon) to face a camera on +z. */
export function rotationFor(lat: number, lon: number): { x: number; y: number } {
  const p = ll2v(lat, lon);
  return { x: THREE.MathUtils.degToRad(lat), y: -Math.atan2(p.x, p.z) };
}

/** True when the pointer moved less than 6 px between pointerdown and pointerup. */
export function isClick(down: { x: number; y: number }, up: { x: number; y: number }): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < 6;
}

/**
 * True when a point on the globe (world space, globe centred at origin) faces the camera.
 * Normal is the normalised point position; the camera direction is from the point to the camera.
 */
export function facesCamera(pointWorld: THREE.Vector3, camera: THREE.Camera): boolean {
  const normal = pointWorld.clone().normalize();
  const toCamera = camera.getWorldPosition(new THREE.Vector3()).sub(pointWorld).normalize();
  return normal.dot(toCamera) > 0.05;
}

/** Id of the pin whose screen position is nearest to `p`, or null when none is within `maxDist` px. */
export function nearestPin(
  p: { x: number; y: number },
  pins: ReadonlyArray<{ id: string; x: number; y: number }>,
  maxDist: number,
): string | null {
  let best: string | null = null;
  let bestD = maxDist;
  for (const pin of pins) {
    const d = Math.hypot(pin.x - p.x, pin.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = pin.id;
    }
  }
  return best;
}
