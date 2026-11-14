import { useEffect, useRef, useState } from "react";
import { CAPTIONS, captionIndex, stepProgress } from "../motion/drill";
import { markSeen, prefersReducedMotion, readSeen } from "../motion/intro";
import { motion } from "../motion/registry";

const BASE = `${import.meta.env.BASE_URL}intro/`;
const FLASH_MS = 600;
const FADE_MS = 700;
const MAX_DT = 0.1; // s: a stalled tab must not jump the clip
const REWIND_RATE = 1.5; // matches stepProgress
const DRIFT = 0.3; // s: re-sync a playing clip only when it drifts this far from progress

type Mode = "idle" | "fwd" | "rev";

type Phase = "off" | "on" | "flash" | "fading";

/**
 * First-visit opening: holding the button (or Space) drives the clip forward, letting go rewinds it.
 * Progress is the clock (stepProgress); the video follows by *playing* natively, never by per-frame
 * seeking: the forward clip while held, a pre-reversed copy (intro_rev.mp4) at 1.5x after release.
 * A clip is seeked only when the mode switches or it drifts more than DRIFT from progress.
 * Reaching the end flashes white and hands over to the 3D intro (useMotion waits while
 * motion.videoPlaying is true).
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
  const rev = useRef<HTMLVideoElement>(null);
  const mode = useRef<Mode>("idle");
  const [showRev, setShowRev] = useState(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    holding.current = false;
    markSeen(); // also covers reduced motion, where the 3D intro never marks it
    motion.videoPlaying = false;
    setPhase("fading");
  };

  // Hold input: button press or Space; any release, cancel or lost focus stops it.
  useEffect(() => {
    if (phase !== "on" || reduced) return;
    const stop = () => void (holding.current = false);
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // Space on another button (Skip) activates that button instead of drilling.
      const t = e.target as Element | null;
      if (t?.closest?.("button") && !t.closest(".drill-hold")) return;
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

  // Frame loop: step progress, keep the playing clip in step with it.
  useEffect(() => {
    if (phase !== "on" || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      const f = video.current;
      const r = rev.current;
      const duration = f?.duration ?? NaN;
      const next = stepProgress(pRef.current, holding.current, dt, duration);
      if (next !== pRef.current) {
        pRef.current = next;
        setP(next);
      }
      if (f && r && Number.isFinite(duration)) {
        const want: Mode = next >= 1 ? "idle" : holding.current ? "fwd" : next > 0 ? "rev" : "idle";
        const active = want === "fwd" ? f : want === "rev" ? r : null;
        const at = want === "rev" ? (1 - next) * duration : next * duration;
        if (want !== mode.current) {
          mode.current = want;
          (want === "fwd" ? r : f).pause();
          if (active) {
            active.currentTime = at;
            active.playbackRate = want === "rev" ? REWIND_RATE : 1;
            void active.play()?.catch(() => {});
          } else {
            r.pause();
            f.pause();
          }
          setShowRev(want === "rev");
        } else if (active && !active.seeking && Math.abs(active.currentTime - at) > DRIFT) {
          active.currentTime = at;
        }
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

  // Re-assert on (re)mount: StrictMode's dev remount runs the cleanup below once before the real mount.
  useEffect(() => {
    if (phase !== "off" && !done.current) motion.videoPlaying = true;
    return () => void (motion.videoPlaying = false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <video
        ref={rev}
        className={`drill-video${showRev ? " drill-video--on" : ""}`}
        src={`${BASE}intro_rev.mp4`}
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
              // iOS often ignores preload: a hold is a user gesture, so ask for the clip now.
              const v = video.current;
              if (v && v.readyState === 0) v.load();
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
