import { describe, expect, it } from "vitest";
import { ScoreMap } from "./scoreMap";

function synthetic(fn: (x: number, y: number) => [number, number]) {
  const width = 360;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [v, a] = fn(x, y);
      data.set([v, v, v, a], (y * width + x) * 4);
    }
  return { width, height, data };
}

describe("ScoreMap", () => {
  it("wraps across the antimeridian and reads the right columns", () => {
    const m = new ScoreMap(synthetic((x) => [x === 359 ? 255 : x === 0 ? 51 : 100, 255]));
    expect(m.sample(0, 179.95)).toBe(1);
    expect(m.sample(0, -179.95)).toBeCloseTo(0.2);
    expect(m.sample(0, 180)).toBeCloseTo(0.2); // wraps to column 0
    expect(m.sample(0, -180.5)).toBe(1); // wraps to column 359
  });

  it("maps latitude to rows and clamps at the poles", () => {
    const m = new ScoreMap(synthetic((_x, y) => [y === 0 ? 255 : y === 179 ? 51 : 100, 255]));
    expect(m.sample(90, 0)).toBe(1);
    expect(m.sample(-90, 0)).toBeCloseTo(0.2);
    expect(m.sample(89.5, 0)).toBe(1);
  });

  it("returns null and isPermafrost=false where alpha is 0", () => {
    const m = new ScoreMap(synthetic((x) => [200, x === 10 ? 0 : 255]));
    expect(m.sample(0, -169.5)).toBeNull();
    expect(m.isPermafrost(0, -169.5)).toBe(false);
    expect(m.isPermafrost(0, 0)).toBe(true);
  });

  it("topThreshold(0.1) of scores 0..99 is about 0.9", () => {
    const m = new ScoreMap(synthetic((x, y) => [Math.round(((x + y * 360) % 100) * 2.55), 255]));
    expect(m.topThreshold(0.1)).toBeGreaterThan(0.89);
    expect(m.topThreshold(0.1)).toBeLessThan(0.91);
  });

  it("topThreshold ignores transparent pixels", () => {
    const m = new ScoreMap(synthetic((x) => [x < 180 ? 255 : 0, x < 180 ? 0 : 255]));
    expect(m.topThreshold(0.1)).toBe(0);
  });
});
