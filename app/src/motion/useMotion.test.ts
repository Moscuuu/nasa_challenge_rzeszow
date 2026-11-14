import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { motion } from "./registry";
import { useMotion } from "./useMotion";

afterEach(() => {
  localStorage.clear();
  motion.videoPlaying = false;
});

const refs = () => [{ current: null }, { current: null }] as const;

describe("useMotion veil", () => {
  it("is dropped by a click before the scenes are ready", () => {
    const [m, e] = refs();
    const { result } = renderHook(() => useMotion(m, e, true));
    expect(result.current).toBe(true);
    act(() => void window.dispatchEvent(new Event("pointerdown")));
    expect(result.current).toBe(false);
  });

  it("ignores clicks and keys while the drill intro is up", () => {
    motion.videoPlaying = true;
    const [m, e] = refs();
    const { result } = renderHook(() => useMotion(m, e, true));
    act(() => void window.dispatchEvent(new Event("pointerdown")));
    act(() => void window.dispatchEvent(new Event("keydown")));
    expect(result.current).toBe(true);
  });

  it("is dropped by any key before the scenes are ready", () => {
    const [m, e] = refs();
    const { result } = renderHook(() => useMotion(m, e, true));
    act(() => void window.dispatchEvent(new Event("keydown")));
    expect(result.current).toBe(false);
  });

  it("is dropped when the data failed to load", () => {
    const [m, e] = refs();
    const { result, rerender } = renderHook(({ failed }) => useMotion(m, e, true, failed), { initialProps: { failed: false } });
    expect(result.current).toBe(true);
    rerender({ failed: true });
    expect(result.current).toBe(false);
  });
});
