import { describe, expect, it } from "vitest";
import { HEAT_CORE, HEAT_DIM, HEAT_HALO, hotContour, topDimAlpha, heatAlpha, topHeatAlpha, PULSE_CLEAR_MIN, pulseClear, unpackTexel } from "./heat";

describe("heatAlpha", () => {
  it("is 0 where the filtered mask is below 0.5 (edge of permafrost)", () => {
    expect(heatAlpha(0.9, 0.4, 0.8, true)).toBe(0);
    expect(heatAlpha(0.9, 0.6, 0.8, true)).toBeGreaterThan(0);
  });

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

describe("unpackTexel", () => {
  it("undoes dilution by no-permafrost texels", () => {
    // Half the footprint is permafrost with score 0.9: R = 0.45, G = 0.5.
    const { score, mask } = unpackTexel(0.45, 0.5);
    expect(score).toBeCloseTo(0.9);
    expect(mask).toBe(0.5);
  });

  it("gives score 0 and mask 0 where there is no permafrost", () => {
    expect(unpackTexel(0, 0)).toEqual({ score: 0, mask: 0 });
  });
});

describe("pulseClear", () => {
  it("dims heat at the pulse centre and leaves it untouched outside the rings", () => {
    expect(pulseClear(0, 0.15)).toBeCloseTo(PULSE_CLEAR_MIN);
    expect(pulseClear(0.15, 0.15)).toBe(1);
    expect(pulseClear(0.07, 0.15)).toBeGreaterThan(PULSE_CLEAR_MIN);
    expect(pulseClear(0.07, 0.15)).toBeLessThan(1);
  });

  it("is 1 everywhere without a pulse", () => {
    expect(pulseClear(0, 0)).toBe(1);
  });
});

describe("topHeatAlpha", () => {
  it("shows a solid core where the top-10 % texels fill the pixel", () => {
    expect(topHeatAlpha(1, 1, 1)).toBeCloseTo(HEAT_CORE);
  });
  it("gives only the soft halo near a small cluster, and nothing far away", () => {
    expect(topHeatAlpha(0, 0.5, 1)).toBeCloseTo(HEAT_HALO);
    expect(topHeatAlpha(0, 0, 1)).toBe(0);
  });
  it("has no core outside permafrost", () => {
    expect(topHeatAlpha(1, 0, 0.2)).toBe(0);
  });
});

describe("topDimAlpha", () => {
  it("leaves hot regions lit and dims the rest", () => {
    expect(topDimAlpha(1, 1)).toBe(0);
    expect(topDimAlpha(0, 0)).toBeCloseTo(HEAT_DIM);
  });
  it("lifts the dimming softly around small clusters", () => {
    expect(topDimAlpha(0, 0.5)).toBeLessThan(HEAT_DIM);
    expect(topDimAlpha(0, 0.5)).toBeGreaterThan(0);
  });
});

describe("hotContour", () => {
  it("peaks on the 0.5 iso-line and vanishes away from it", () => {
    expect(hotContour(0.5, 0.1)).toBe(1);
    expect(hotContour(0.9, 0.1)).toBe(0);
    expect(hotContour(0.45, 0.1)).toBeGreaterThan(0);
  });
});
