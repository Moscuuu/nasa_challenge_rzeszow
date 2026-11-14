import { describe, expect, it } from "vitest";
import { CAPTIONS, captionIndex, stepProgress } from "./drill";

describe("stepProgress", () => {
  it("moves forward at 1x while holding", () => {
    expect(stepProgress(0, true, 1, 10)).toBeCloseTo(0.1);
  });
  it("rewinds at 1.5x when released", () => {
    expect(stepProgress(0.5, false, 1, 10)).toBeCloseTo(0.35);
  });
  it("clamps to 0..1", () => {
    expect(stepProgress(0.99, true, 1, 10)).toBe(1);
    expect(stepProgress(0.05, false, 1, 10)).toBe(0);
  });
  it("leaves progress alone while the duration is unknown", () => {
    expect(stepProgress(0.4, true, 1, 0)).toBe(0.4);
    expect(stepProgress(0.4, true, 1, NaN)).toBe(0.4);
  });
});

describe("captionIndex", () => {
  it("splits progress into thirds", () => {
    expect(captionIndex(0)).toBe(0);
    expect(captionIndex(0.34)).toBe(1);
    expect(captionIndex(0.67)).toBe(2);
    expect(captionIndex(1)).toBe(2);
  });
});

it("captions carry the approved copy", () => {
  expect(CAPTIONS).toEqual([
    "Mars hides its water as ice, under the dust.",
    "Earth has places with the same frozen ground.",
    "Before we drill there, we practice here.",
  ]);
});
