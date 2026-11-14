import { useEffect, useRef } from "react";

/** Small deterministic PRNG (mulberry32): the same sky on every load and resize. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TINTS = ["255,255,255", "214,228,255", "255,240,220", "200,215,255"];

/**
 * One shared night sky behind the whole page, so Mars and Earth float in the same space instead
 * of sitting in boxes. A static 2D canvas (drawn once per resize), under the transparent 3D canvas.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // jsdom / no 2D canvas: the plain background stays
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const rand = rng(7);

      // Faint haze: a diagonal band and two soft clouds give the sky depth.
      const band = ctx.createLinearGradient(0, h, w, 0);
      band.addColorStop(0, "rgba(80,100,150,0)");
      band.addColorStop(0.45, "rgba(80,100,150,0.05)");
      band.addColorStop(0.55, "rgba(120,100,150,0.06)");
      band.addColorStop(1, "rgba(80,100,150,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, h);
      for (const [cx, cy, r, c] of [
        [0.18, 0.3, 0.35, "70,90,140"],
        [0.82, 0.72, 0.4, "120,80,90"],
      ] as const) {
        const g = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r * Math.max(w, h));
        g.addColorStop(0, `rgba(${c},0.07)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Stars: many faint specks, a few bright ones with a soft glow.
      const count = Math.round((w * h) / 1700);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const m = rand() ** 6; // magnitude: mostly faint
        const r = 0.35 + m * 1.3;
        const a = 0.25 + m * 0.75;
        const tint = TINTS[Math.floor(rand() * TINTS.length)];
        if (m > 0.35) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
          g.addColorStop(0, `rgba(${tint},${a * 0.35})`);
          g.addColorStop(1, `rgba(${tint},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
        }
        ctx.fillStyle = `rgba(${tint},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
