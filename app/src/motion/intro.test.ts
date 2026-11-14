import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseIntro, clearSeen, markSeen, readSeen } from "./intro";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("chooseIntro", () => {
  it("plays the full intro on a first visit", () => expect(chooseIntro(false, false)).toBe("full"));
  it("plays the short intro on later visits", () => expect(chooseIntro(true, false)).toBe("short"));
  it("skips the intro with reduced motion", () => {
    expect(chooseIntro(false, true)).toBe("none");
    expect(chooseIntro(true, true)).toBe("none");
  });
});

describe("readSeen / markSeen", () => {
  it("round-trips through localStorage", () => {
    expect(readSeen()).toBe(false);
    markSeen();
    expect(readSeen()).toBe(true);
  });
  it("returns false when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSeen()).toBe(false);
  });
  it("markSeen does not throw when setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => markSeen()).not.toThrow();
  });
});

describe("clearSeen", () => {
  it("makes the next visit a first visit again", () => {
    markSeen();
    clearSeen();
    expect(readSeen()).toBe(false);
  });
  it("does not throw when removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearSeen()).not.toThrow();
  });
});
