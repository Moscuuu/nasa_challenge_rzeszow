import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, readSeen } from "../motion/intro";
import { motion } from "../motion/registry";

const SRC = `${import.meta.env.BASE_URL}intro/intro.mp4`;
const FADE_MS = 700;

/**
 * Opening clip, first visit only (not with reduced motion). Plays full-screen over the intro veil,
 * then fades out and hands over to the 3D intro. Any click or key skips it (and the 3D intro).
 * A missing or broken file just ends it, so the page works without the video.
 */
export function IntroVideo() {
  const [state, setState] = useState<"off" | "on" | "fading">(() => {
    const play = !readSeen() && !prefersReducedMotion();
    motion.videoPlaying = play;
    return play ? "on" : "off";
  });
  const video = useRef<HTMLVideoElement>(null);

  const finish = () => {
    if (!motion.videoPlaying) return;
    motion.videoPlaying = false;
    video.current?.pause();
    setState("fading");
  };

  useEffect(() => {
    if (state === "off") return;
    if (state === "fading") {
      const t = setTimeout(() => setState("off"), FADE_MS);
      return () => clearTimeout(t);
    }
    const skip = () => finish();
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    void video.current?.play().catch(finish); // autoplay blocked: go straight to the 3D intro
    return () => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
    };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => void (motion.videoPlaying = false), []);

  if (state === "off") return null;
  return (
    <div className={`intro-video${state === "fading" ? " intro-video--out" : ""}`} aria-hidden="true">
      <video ref={video} src={SRC} muted playsInline preload="auto" onEnded={finish} onError={finish} />
      <p className="intro-video-skip">Click or press any key to skip</p>
    </div>
  );
}
