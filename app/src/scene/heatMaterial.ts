import * as THREE from "three";
import type { ScoreMap } from "../data/scoreMap";
import { HEAT_MAX, HEAT_MIN_ALL, HEAT_MIN_TOP } from "./heat";

/**
 * Frost white (--frost). The overlay has no other colour: colour lives only in the satellite imagery.
 * Raw sRGB values: the shader writes them straight to the canvas (no colour-space conversion).
 */
const FROST = new THREE.Color().setHex(0xd9ecfa, THREE.LinearSRGBColorSpace);
/** Default opacity of the permafrost contour line. */
export const OUTLINE_OPACITY = 0.35;

/**
 * Score PNG as a data texture. Nearest filtering on both ends, so alpha-0 (no permafrost)
 * pixels never blend into their neighbours: heat is only ever drawn on permafrost pixels.
 */
export function scoreTexture(map: ScoreMap): THREE.DataTexture {
  const src = map.textureData;
  const data = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  const tex = new THREE.DataTexture(data, map.width, map.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping; // lon wraps across ±180
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace; // raw score bytes, not colour
  tex.needsUpdate = true;
  return tex;
}

/**
 * Permafrost mask (PNG alpha only) with linear filtering and mipmaps. Used only for the contour:
 * its 0.5 iso-line is a clean line at every zoom, where the nearest-filtered alpha would sparkle.
 */
export function maskTexture(map: ScoreMap): THREE.DataTexture {
  const src = map.textureData;
  const alpha = new Uint8Array(map.width * map.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = src[i * 4 + 3] === 0 ? 0 : 255;
  const tex = new THREE.DataTexture(alpha, map.width, map.height, THREE.RedFormat, THREE.UnsignedByteType);
  tex.unpackAlignment = 1;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
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
  uniform sampler2D uMask;
  uniform float uThreshold;
  uniform float uShowAll;
  uniform vec3 uOrigin;
  uniform float uReveal;
  uniform float uOutline;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;

  // GLSL twin of heatAlpha() in heat.ts: keep the two in sync.
  float heatAlpha(float score, float alpha, float threshold, bool showAll) {
    if (alpha <= 0.0) return 0.0;
    if (showAll) return ${f(HEAT_MIN_ALL)} + ${f(HEAT_MAX - HEAT_MIN_ALL)} * clamp(score, 0.0, 1.0);
    if (score < threshold) return 0.0;
    float t = threshold >= 1.0 ? 1.0 : (score - threshold) / (1.0 - threshold);
    return ${f(HEAT_MIN_TOP)} + ${f(HEAT_MAX - HEAT_MIN_TOP)} * clamp(t, 0.0, 1.0);
  }

  void main() {
    // PNG row 0 is lat +90; SphereGeometry v = 1 at the north pole.
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 s = texture2D(uScore, uv);
    float heat = heatAlpha(s.r, s.a, uThreshold, uShowAll > 0.5);

    // Reveal: only within uReveal radians of uOrigin (soft 0.05 rad edge). uReveal = PI shows all.
    float ang = acos(clamp(dot(normalize(vPos), uOrigin), -1.0, 1.0));
    heat *= uReveal >= PI - 0.001 ? 1.0 : 1.0 - smoothstep(uReveal - 0.05, uReveal, ang);

    // Permafrost contour: the 0.5 iso-line of the smoothed mask, about one screen pixel wide.
    float m = texture2D(uMask, uv).r;
    float edge = 1.0 - smoothstep(0.0, max(fwidth(m), 1e-4), abs(m - 0.5));

    float a = max(heat, uOutline * edge);
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export interface HeatUniforms {
  [name: string]: THREE.IUniform;
  uScore: THREE.IUniform<THREE.Texture | null>;
  /** Permafrost mask for the contour (see maskTexture). */
  uMask: THREE.IUniform<THREE.Texture | null>;
  uThreshold: THREE.IUniform<number>;
  uShowAll: THREE.IUniform<number>;
  uOrigin: THREE.IUniform<THREE.Vector3>;
  uReveal: THREE.IUniform<number>;
  uOutline: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
}

/** Transparent overlay: frost-white heat map of the score PNG plus the permafrost contour. */
export function createHeatMaterial(): THREE.ShaderMaterial & { uniforms: HeatUniforms } {
  const uniforms: HeatUniforms = {
    uScore: { value: null },
    uMask: { value: null },
    uThreshold: { value: 1 },
    uShowAll: { value: 0 },
    uOrigin: { value: new THREE.Vector3(0, 1, 0) },
    uReveal: { value: Math.PI },
    uOutline: { value: OUTLINE_OPACITY },
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
