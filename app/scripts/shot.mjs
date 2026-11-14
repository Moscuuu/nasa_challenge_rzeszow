// Screenshot the running app: node scripts/shot.mjs <url> <out.png> [width] [height]
// Waits for the 3D canvas, then a short settle so textures and pins are drawn.
import { chromium } from "@playwright/test";

const [url, out, width = "1440", height = "900"] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [width] [height]");
  process.exit(1);
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[console.${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
