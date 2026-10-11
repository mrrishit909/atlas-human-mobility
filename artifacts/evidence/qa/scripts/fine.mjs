import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: false });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
await page.keyboard.press("Escape");
await page.evaluate(() => window.__atlas.jumpTo("demand", 0.45)); await page.waitForTimeout(5000);
const out = [];
for (const p of [0.6, 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7]) {
  await page.evaluate((q) => window.__atlas.jumpTo("demand", q), p); await page.waitForTimeout(1800);
  // count non-black pixels in the stage area via canvas readback of a screenshot
  const buf = await page.screenshot({ clip: { x: 500, y: 100, width: 900, height: 700 } });
  out.push([p, buf.length]);
}
// also scroll slowly by wheel across the handoff and record
await page.evaluate(() => window.__atlas.jumpTo("demand", 0.6)); await page.waitForTimeout(1500);
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(250); const buf = await page.screenshot({ clip: { x: 500, y: 100, width: 900, height: 700 } }); out.push(["wheel" + i, (await page.evaluate(() => window.__atlas.getProgress?.("demand") ?? null)), buf.length]); }
console.log(JSON.stringify(out));
await b.close();
