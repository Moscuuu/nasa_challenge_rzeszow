import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTextureSize } from "./useTextureSize";

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: "(max-width: 700px)",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    change(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useTextureSize", () => {
  it('returns "2k" when the phone query matches', () => {
    const { matchMedia } = mockMatchMedia(true);
    const { result } = renderHook(() => useTextureSize());
    expect(result.current).toBe("2k");
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 700px)");
  });

  it('returns "4k" on wider screens and follows query changes', () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useTextureSize());
    expect(result.current).toBe("4k");
    act(() => mm.change(true));
    expect(result.current).toBe("2k");
  });
});
