export const NO_WEBGL_MESSAGE = "Your browser can't show the 3D globes.";

/** True when the browser can create a WebGL context. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // release the probe context
    return Boolean(gl);
  } catch {
    return false;
  }
}
