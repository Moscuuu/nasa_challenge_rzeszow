import { chromium } from "@playwright/test";
const [out, mode = "pick"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => { if (m.type()==="error") console.log("[err]", m.text()); });
await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await page.waitForSelector("canvas");
await page.waitForTimeout(7000);
if (mode !== "default") {
  await page.evaluate(() => window.__store.getState().selectSite("amazonis_posiolova"));
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => { const g=window.__store.getState(); return {focus:g.focus, top:g.list[0]&&[g.list[0].lat,g.list[0].lon]}; });
  console.log(JSON.stringify(s));
}
if (mode === "all") { await page.evaluate(() => window.__store.getState().toggleShowAll()); await page.waitForTimeout(800); }
if (mode === "step") { await page.evaluate(() => window.__store.getState().step(1)); await page.waitForTimeout(5000);
  console.log(JSON.stringify(await page.evaluate(()=>window.__store.getState().focus))); }
await page.screenshot({ path: out });
await browser.close();
