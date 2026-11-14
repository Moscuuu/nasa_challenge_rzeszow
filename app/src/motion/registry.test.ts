import { describe, expect, it } from "vitest";
import { motion, onVideoPlaying } from "./registry";

describe("motion.videoPlaying", () => {
  it("notifies subscribers on change, not on same-value writes", () => {
    const heard: boolean[] = [];
    const off = onVideoPlaying(() => heard.push(motion.videoPlaying));
    motion.videoPlaying = true;
    motion.videoPlaying = true;
    motion.videoPlaying = false;
    off();
    motion.videoPlaying = true;
    motion.videoPlaying = false;
    expect(heard).toEqual([true, false]);
  });
});
