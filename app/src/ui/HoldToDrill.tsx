import { useEffect, useRef, useState } from "react";
import { CAPTIONS, captionIndex, stepProgress } from "../motion/drill";
import { prefersReducedMotion, readSeen } from "../motion/intro";
import { motion } from "../motion/registry";

const BASE = `${import.meta.env.BASE_URL}intro/`;
const FLASH_MS = 600;
const FADE_MS = 700;
const MAX_DT = 0.1; // s: a stalled tab must not jump the clip

type Phase = "off" | "on" | "flash" | "fading";

/**
 * First-visit opening: holding the button (or Space) drives the clip forward, letting go rewinds it.
 * The clip is never played, only seeked, so it works with autoplay blocked. Reaching the end flashes
 * white and hands over to the 3D intro (useMotion waits while motion.videoPlaying is true).
 */
export function HoldToDrill() {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(() => {
    const play = !readSeen();
    motion.videoPlaying = play;
    return play ? "on" : "off";
  });
  const [p, setP] = useState(0);
  const pRef = useRef(0);
  const holding = useRef(false);
  const done = useRef(false);
  const video = useRef<HTMLVideoElement>(null);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    holding.current = false;
    motion.videoPlaying = false;
    setPhase("fading");
  };

  // Hold input: button press or Space; any release, cancel or lost focus stops it.
  useEffect(() => {
    if (phase !== "on" || reduced) return;
    const stop = () => void (holding.current = false);
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (!e.repeat) holding.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") stop();
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, reduced]);

  // Frame loop: step progress, seek the clip to match.
  useEffect(() => {
    if (phase !== "on" || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      const v = video.current;
      const duration = v?.duration ?? NaN;
      const next = stepProgress(pRef.current, holding.current, dt, duration);
      if (next !== pRef.current) {
        pRef.current = next;
        setP(next);
        if (v && Number.isFinite(duration)) v.currentTime = next * duration;
      }
      if (next >= 1) {
        holding.current = false;
        setPhase("flash");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  useEffect(() => {
    if (phase === "flash") {
      const t = setTimeout(finish, FLASH_MS);
      return () => clearTimeout(t);
    }
    if (phase === "fading") {
      const t = setTimeout(() => setPhase("off"), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => void (motion.videoPlaying = false), []);

  if (phase === "off") return null;
  const caption = CAPTIONS[captionIndex(p)];
  return (
    <div
      className={`drill drill--${phase}`}
      role="dialog"
      aria-label="Intro"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={video}
        className="drill-video"
        src={`${BASE}intro.mp4`}
        poster={`${BASE}poster.jpg`}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onError={finish}
      />
      <p key={caption} className="drill-caption" aria-live="polite">
        {caption}
      </p>
      <div className="drill-controls">
        {reduced ? (
          <button type="button" className="drill-hold" onClick={finish}>
            Enter
          </button>
        ) : (
          <button
            type="button"
            className="drill-hold"
            onPointerDown={(e) => {
              e.preventDefault();
              holding.current = true;
            }}
          >
            <span className="drill-dot" aria-hidden="true" /> Hold to drill
          </button>
        )}
        <p className="drill-hint">{reduced ? "" : "Press and hold — or hold Space"}</p>
      </div>
      <div className="drill-progress" role="progressbar" aria-label="Drill depth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <i style={{ width: `${p * 100}%` }} />
      </div>
      <button type="button" className="drill-skip" onClick={finish}>
        Skip →
      </button>
    </div>
  );
}
