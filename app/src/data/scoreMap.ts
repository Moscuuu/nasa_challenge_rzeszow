export interface RasterLike {
  width: number;
  height: number;
  /** RGBA, row-major, top row = lat +90 */
  data: Uint8ClampedArray;
}

/** Equirectangular score raster: R=G=B=score*255, alpha 0 = no permafrost. */
export class ScoreMap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(img: RasterLike) {
    this.width = img.width;
    this.height = img.height;
    this.data = img.data;
  }

  private index(lat: number, lon: number): number {
    const w = this.width;
    const x = ((Math.floor(((lon + 180) / 360) * w) % w) + w) % w;
    const y = Math.min(this.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * this.height)));
    return (y * w + x) * 4;
  }

  /** Score 0..1, or null where alpha = 0 (no permafrost). */
  sample(lat: number, lon: number): number | null {
    const i = this.index(lat, lon);
    return this.data[i + 3] === 0 ? null : this.data[i] / 255;
  }

  isPermafrost(lat: number, lon: number): boolean {
    return this.data[this.index(lat, lon) + 3] !== 0;
  }

  /** Score at the (1 - fraction) percentile of opaque pixels; 0 if there are none. */
  topThreshold(fraction: number): number {
    const values: number[] = [];
    for (let i = 0; i < this.data.length; i += 4) if (this.data[i + 3] !== 0) values.push(this.data[i]);
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const k = Math.min(values.length - 1, Math.max(0, Math.floor((1 - fraction) * values.length)));
    return values[k] / 255;
  }

  /** Raw RGBA bytes for a shader DataTexture. */
  get textureData(): Uint8ClampedArray {
    return this.data;
  }
}

/** Browser PNG decode without colour management or alpha premultiplication. */
export async function decodePng(url: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<RasterLike> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const { width, height } = bitmap;
  const ctx =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height).getContext("2d")
      : Object.assign(document.createElement("canvas"), { width, height }).getContext("2d");
  if (!ctx) throw new Error(`Cannot decode ${url}: no 2d context`);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data };
}
