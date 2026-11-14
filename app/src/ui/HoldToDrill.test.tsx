import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { motion } from "../motion/registry";
import { HoldToDrill } from "./HoldToDrill";

const progress = () => Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
const frames = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  // jsdom has no media pipeline: give the clip a 10 s duration.
  Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get: () => 10 });
});
afterEach(() => {
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
});
