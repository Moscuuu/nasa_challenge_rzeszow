import * as THREE from "three";
import type { ScoreMap } from "../data/scoreMap";
import { HEAT_CORE, HEAT_HALO, HEAT_MAX, HEAT_MIN_ALL, HEAT_MIN_TOP, MASK_EPS, PULSE_CLEAR_MIN } from "./heat";

/**
 * Frost white (--frost). The overlay has no other colour: colour lives only in the satellite imagery.
 * Raw sRGB values: the shader writes them straight to the canvas (no colour-space conversion).
 */
const FROST = new THREE.Color().setHex(0xd9ecfa, THREE.LinearSRGBColorSpace);
/** Default opacity of the permafrost contour line. */
export const OUTLINE_OPACITY = 0.14;

/**
 * Score PNG packed into one RGBA texture: B = score >= threshold (top-10 % indicator), R = score · mask, G = mask (1 on permafrost,
 * 0 where the PNG alpha is 0). Linear filtering + mipmaps average both channels over a screen
 * pixel's footprint, so the heat reads as smooth regions at every zoom; the shader divides R by G
 * to get the score of the permafrost part only (see unpackTexel in heat.ts).
 */
export function scoreTexture(map: ScoreMap, threshold = 1): THREE.DataTexture {
  const src = map.textureData;
  const n = map.width * map.height;
  const cut = threshold * 255;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const on = src[i * 4 + 3] !== 0;
    rgba[i * 4] = on ? src[i * 4] : 0;
    rgba[i * 4 + 1] = on ? 255 : 0;
    rgba[i * 4 + 2] = on && src[i * 4] >= cut ? 255 : 0; // B = top-10 % indicator
    rgba[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(rgba, map.width, map.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping; // lon wraps across +-180
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace; // raw score bytes, not colour
  tex.needsUpdate = true;
  return tex;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const f = (x: number) => x.toFixed(4);

const fragmentShader = /* glsl */ `
  #define PI 3.14159265
  uniform sampler2D uScore;
  uniform float uThreshold;
  uniform float uShowAll;
  uniform vec3 uOrigin;
  uniform float uReveal;
  uniform float uOutline;
  uniform float uPulseRadius;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;

  // GLSL twins of heatAlpha() and pulseClear() in heat.ts: keep them in sync.
  float heatAlpha(float score, float mask, float threshold, bool showAll) {
    if (mask < 0.5) return 0.0;
    if (showAll) return ${f(HEAT_MIN_ALL)} + ${f(HEAT_MAX - HEAT_MIN_ALL)} * clamp(score, 0.0, 1.0);
    if (score < threshold) return 0.0;
    float t = threshold >= 1.0 ? 1.0 : (score - threshold) / (1.0 - threshold);
    return ${f(HEAT_MIN_TOP)} + ${f(HEAT_MAX - HEAT_MIN_TOP)} * clamp(t, 0.0, 1.0);
  }

  float topHeatAlpha(float hot, float halo, float mask) {
    float core = mask < 0.5 ? 0.0 : ${f(HEAT_CORE)} * smoothstep(0.2, 0.6, hot);
    return max(core, ${f(HEAT_HALO)} * smoothstep(0.02, 0.5, halo));
  }

  float pulseClear(float angle, float radius) {
    if (radius <= 0.0) return 1.0;
    return ${f(PULSE_CLEAR_MIN)} + ${f(1 - PULSE_CLEAR_MIN)} * smoothstep(0.0, radius, angle);
  }

  void main() {
    // PNG row 0 is lat +90; SphereGeometry v = 1 at the north pole.
    vec2 rg = texture2D(uScore, vec2(vUv.x, 1.0 - vUv.y)).rg;
    float mask = rg.g;
    float score = mask > 0.0 ? min(1.0, rg.r / max(mask, ${f(MASK_EPS)})) : 0.0; // unpackTexel
    float heat;
    if (uShowAll > 0.5) {
      heat = heatAlpha(score, mask, uThreshold, true);
    } else {
      // Coarser mip bias keeps small clusters visible at far zoom; the halo is a much blurrier copy.
      float hot = texture2D(uScore, vec2(vUv.x, 1.0 - vUv.y), 1.5).b;
      float halo = texture2D(uScore, vec2(vUv.x, 1.0 - vUv.y), 4.5).b;
      heat = topHeatAlpha(hot, halo, mask);
    }

    float ang = acos(clamp(dot(normalize(vPos), uOrigin), -1.0, 1.0));
    // Reveal: only within uReveal radians of uOrigin (soft 0.05 rad edge). uReveal = PI shows all.
    heat *= uReveal >= PI - 0.001 ? 1.0 : 1.0 - smoothstep(uReveal - 0.05, uReveal, ang);
    // Thin the heat under the pulse rings so they read on dense heat.
    heat *= pulseClear(ang, uPulseRadius);

    // Permafrost contour: the 0.5 iso-line of the filtered mask, about one screen pixel wide.
    float edge = 1.0 - smoothstep(0.0, max(fwidth(mask), 1e-4), abs(mask - 0.5));

    float a = max(heat, uOutline * edge);
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export interface HeatUniforms {
  [name: string]: THREE.IUniform;
  /** RG score texture (see scoreTexture). */
  uScore: THREE.IUniform<THREE.Texture | null>;
  uThreshold: THREE.IUniform<number>;
  uShowAll: THREE.IUniform<number>;
  uOrigin: THREE.IUniform<THREE.Vector3>;
  uReveal: THREE.IUniform<number>;
  uOutline: THREE.IUniform<number>;
  /** Angular radius of the pulse around uOrigin where heat is thinned; 0 = no pulse. */
  uPulseRadius: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
}

/** Transparent overlay: frost-white heat map of the score PNG plus the permafrost contour. */
export function createHeatMaterial(): THREE.ShaderMaterial & { uniforms: HeatUniforms } {
  const uniforms: HeatUniforms = {
    uScore: { value: null },
    uThreshold: { value: 1 },
    uShowAll: { value: 0 },
    uOrigin: { value: new THREE.Vector3(0, 1, 0) },
    uReveal: { value: Math.PI },
    uOutline: { value: OUTLINE_OPACITY },
    uPulseRadius: { value: 0 },
    uColor: { value: FROST.clone() },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }) as THREE.ShaderMaterial & { uniforms: HeatUniforms };
}
