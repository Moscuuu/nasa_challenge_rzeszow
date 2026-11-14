import { describe, expect, it } from "vitest";
import { heatAlpha } from "./heat";

describe("heatAlpha", () => {
  it("is 0 outside permafrost (alpha 0), even with Show all", () => {
    expect(heatAlpha(0.9, 0, 0.8, false)).toBe(0);
    expect(heatAlpha(0.9, 0, 0.8, true)).toBe(0);
  });

  it("hides scores below the top-10 % threshold", () => {
    expect(heatAlpha(0.5, 1, 0.8, false)).toBe(0);
  });

  it("shows the same score with Show all", () => {
    expect(heatAlpha(0.5, 1, 0.8, true)).toBeGreaterThan(0);
  });

  it("ramps opacity up with score", () => {
    expect(heatAlpha(0.95, 1, 0.8, false)).toBeGreaterThan(heatAlpha(0.85, 1, 0.8, false));
    expect(heatAlpha(0.95, 1, 0.8, true)).toBeGreaterThan(heatAlpha(0.85, 1, 0.8, true));
  });

  it("stays within 0..1", () => {
    for (const s of [0, 0.3, 0.8, 1]) {
      for (const all of [false, true]) {
        const a = heatAlpha(s, 1, 0.8, all);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });
});
