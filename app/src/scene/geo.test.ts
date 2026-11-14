import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { facesCamera, isClick, ll2v, nearestPin, v2ll } from "./geo";

/** Difference between two longitudes as an angle, wrapped to [-180, 180). */
const lonDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

describe("ll2v / v2ll round trip", () => {
  const cases: Array<[number, number]> = [
    [42, -170],
    [-77.55, 160.85],
    [0, 180],
  ];
  it.each(cases)("round-trips lat %f lon %f", (lat, lon) => {
    const out = v2ll(ll2v(lat, lon));
    expect(Math.abs(out.lat - lat)).toBeLessThan(1e-6);
    expect(Math.abs(lonDiff(out.lon, lon))).toBeLessThan(1e-6);
  });

  it("places the point at radius r", () => {
    expect(ll2v(10, 20, 1.012).length()).toBeCloseTo(1.012, 9);
  });
});

describe("isClick", () => {
  it("is true for a 5 px move", () => {
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
  });
  it("is false for a 7 px move", () => {
    expect(isClick({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe(false);
  });
});

describe("facesCamera", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 5);
  camera.updateMatrixWorld();

  it("is true for a point on the camera-facing side", () => {
    expect(facesCamera(new THREE.Vector3(0, 0, 1), camera)).toBe(true);
  });
  it("is false for a point on the far side", () => {
    expect(facesCamera(new THREE.Vector3(0, 0, -1), camera)).toBe(false);
  });
});

describe("nearestPin", () => {
  const pins = [
    { id: "arcadia", x: 100, y: 100 },
    { id: "amazonis", x: 117, y: 100 },
  ];
  it("picks the nearer of two overlapping pins", () => {
    expect(nearestPin({ x: 101, y: 100 }, pins, 28)).toBe("arcadia");
    expect(nearestPin({ x: 110, y: 100 }, pins, 28)).toBe("amazonis");
  });
  it("returns null when no pin is within reach", () => {
    expect(nearestPin({ x: 300, y: 300 }, pins, 28)).toBeNull();
    expect(nearestPin({ x: 0, y: 0 }, [], 28)).toBeNull();
  });
});
