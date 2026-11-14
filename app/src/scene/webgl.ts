export const NO_WEBGL_MESSAGE = "Your browser can't show the 3D globes.";

/** True when the browser can create a WebGL context. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
