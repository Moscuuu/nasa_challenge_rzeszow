import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSeen } from "../motion/intro";
import { motion } from "../motion/registry";
import { HoldToDrill } from "./HoldToDrill";

const progress = () => Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
const frames = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  // jsdom has no media pipeline: give the clip a 10 s duration, record seeks, stub play/pause.
  Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get: () => 10 });
  seeks.clear();
  times = new WeakMap();
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return times.get(this) ?? 0;
    },
    set(this: HTMLMediaElement, t: number) {
      times.set(this, t);
      seeks.set(this, (seeks.get(this) ?? 0) + 1);
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
const seeks = new Map<HTMLMediaElement, number>();
let times = new WeakMap<HTMLMediaElement, number>();
const clips = (c: HTMLElement) => {
  const [fwd, rev] = Array.from(c.querySelectorAll("video"));
  return { fwd, rev };
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  motion.videoPlaying = false;
});

describe("HoldToDrill", () => {
  it("renders nothing when the intro was seen", () => {
    localStorage.setItem("af-intro-seen", "1");
    const { container } = render(<HoldToDrill />);
    expect(container).toBeEmptyDOMElement();
    expect(motion.videoPlaying).toBe(false);
  });

  it("shows the first caption and Hold button on first visit", () => {
    render(<HoldToDrill />);
    expect(screen.getByText("Mars hides its water as ice, under the dust.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hold to drill/i })).toBeInTheDocument();
    expect(motion.videoPlaying).toBe(true);
  });

  it("holding moves progress forward and releasing rewinds", () => {
    render(<HoldToDrill />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    frames(4000);
    const held = progress();
    expect(held).toBeGreaterThan(30);
    expect(screen.getByText("Earth has places with the same frozen ground.")).toBeInTheDocument();
    fireEvent.pointerUp(window);
    frames(1000);
    expect(progress()).toBeLessThan(held);
  });

  it("keeps the 3D intro waiting under StrictMode remounts", () => {
    render(
      <StrictMode>
        <HoldToDrill />
      </StrictMode>,
    );
    expect(motion.videoPlaying).toBe(true);
  });

  it("plays the forward clip while holding instead of seeking every frame", () => {
    const { container } = render(<HoldToDrill />);
    const { fwd } = clips(container);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    frames(1000);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    // ~60 frames; the stub never advances, so only the switch + drift re-syncs (every >0.3 s) seek.
    expect(seeks.get(fwd) ?? 0).toBeLessThanOrEqual(5);
  });

  it("plays the reversed clip from the mirrored time on release, at 1.5x", () => {
    const { container } = render(<HoldToDrill />);
    const { rev } = clips(container);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    frames(2000);
    fireEvent.pointerUp(window);
    frames(50);
    expect(rev.playbackRate).toBe(1.5);
    expect(rev.currentTime).toBeGreaterThan(7.5);
    expect(rev.currentTime).toBeLessThan(8.5);
    expect(rev.className).toContain("drill-video--on");
  });

  it("Skip ends it", () => {
    render(<HoldToDrill />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(motion.videoPlaying).toBe(false);
    frames(800);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("video error ends it", () => {
    const { container } = render(<HoldToDrill />);
    fireEvent.error(container.querySelector("video")!);
    expect(motion.videoPlaying).toBe(false);
  });

  it("window blur stops holding", () => {
    render(<HoldToDrill />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    frames(1000);
    fireEvent.blur(window);
    const at = progress();
    frames(1000);
    expect(progress()).toBeLessThanOrEqual(at);
  });

  it("Space repeat does not restart hold after keyup", () => {
    render(<HoldToDrill />);
    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });
    frames(1000);
    fireEvent.keyUp(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });
    const at = progress();
    frames(1000);
    expect(progress()).toBeLessThan(at);
  });

  it("reaching the end finishes the intro", () => {
    render(<HoldToDrill />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    frames(10500);
    expect(screen.getByText("Before we drill there, we practice here.")).toBeInTheDocument();
    frames(1500);
    expect(motion.videoPlaying).toBe(false);
  });

  it("reduced motion shows Enter instead of Hold", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    render(<HoldToDrill />);
    expect(screen.queryByRole("button", { name: /hold to drill/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /enter/i }));
    expect(motion.videoPlaying).toBe(false);
  });

  it("finishing marks the visit seen, so reduced-motion users are not blocked again", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    render(<HoldToDrill />);
    fireEvent.click(screen.getByRole("button", { name: /enter/i }));
    expect(readSeen()).toBe(true);
  });

  it("Space on the Skip button does not start drilling", () => {
    render(<HoldToDrill />);
    const skip = screen.getByRole("button", { name: /skip/i });
    fireEvent.keyDown(skip, { code: "Space", key: " " });
    frames(1000);
    expect(progress()).toBe(0);
  });

  it("first hold asks the browser to load the clip when nothing is loaded yet", () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    render(<HoldToDrill />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /hold to drill/i }));
    expect(load).toHaveBeenCalledTimes(1);
    load.mockRestore();
  });
});
