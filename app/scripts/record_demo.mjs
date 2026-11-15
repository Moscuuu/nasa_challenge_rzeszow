// Record a screen capture of the running app for the demo video.
// usage: node scripts/record_demo.mjs [url] [outDir] [site name]
// Output: <outDir>/demo-raw.webm (1920x1080). Convert to mp4 with ffmpeg afterwards.
import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const [url = "http://localhost:5173", outArg = "../demo-capture", site = "Arcadia Planitia"] = process.argv.slice(2);
const outDir = path.resolve(outArg);
const W = 1920;
const H = 1080;
const pause = (page, ms) => page.waitForTimeout(ms);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: outDir, size: { width: W, height: H } },
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") console.log(`[console.error] ${m.text()}`);
});

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 30000 });
  await pause(page, 3000); // let the opening dive and textures settle

  // Skip the hold-to-drill intro if it is up, so the capture starts on the app itself.
  const skip = page.locator(".drill-skip");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    console.log("intro skipped");
  }

  // Mars: pick the site. Pointer clicks on the 3D pins are routed by the scene raycast, so a
  // focused pin + Enter is the reliable path (the app treats keyboard activation as a pick).
  const siteBtn = page.getByLabel(site, { exact: true });
  await siteBtn.waitFor({ state: "attached", timeout: 30000 });
  await pause(page, 1500);
  await siteBtn.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__store?.getState().stage === "depth", null, { timeout: 15000 });
  console.log(`picked ${site}`);

  // Soil depth: the 1-5 m layer (the one the README headlines).
  const soil = page.locator('[data-layer="1-5m"]');
  await soil.waitFor({ state: "visible", timeout: 30000 });
  await pause(page, 1500);
  await soil.click();
  console.log("soil 1-5 m");

  // Earth: pick the top region (keyboard, as for the Mars pins). Picking a region zooms in and opens the card.
  const regionPin = page.locator('button[aria-label^="#1 "]').first();
  await regionPin.waitFor({ state: "attached", timeout: 60000 });
  await pause(page, 3000);
  await regionPin.focus();
  await page.keyboard.press("Enter");
  console.log("earth region #1");

  const card = page.getByLabel("Analog card");
  await card.waitFor({ state: "visible", timeout: 60000 });
  await pause(page, 3000);
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("Next cell").click();
    await pause(page, 2000);
  }
  console.log("walkthrough done");
  await pause(page, 1500);
} catch (e) {
  console.log(`[record failed] ${e.message}`);
  process.exitCode = 1;
} finally {
  const video = page.video();
  const tmp = video ? await video.path() : null; // resolves once the file is flushed on close
  await context.close();
  await browser.close();
  if (tmp) {
    const dest = path.join(outDir, "demo-raw.webm");
    await copyFile(tmp, dest);
    console.log(`saved ${dest}`);
  }
}
