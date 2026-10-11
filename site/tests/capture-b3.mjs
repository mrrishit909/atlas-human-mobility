#!/usr/bin/env node
/**
 * Stage B3 evidence: only the frames the B3 fixes touch (S05, S06, S07 rain, M OBS inspector) on the PRODUCTION build (dist/, in-process vite preview).
 * Usage: npm run build && node tests/capture-b1.mjs [--only 1440x900] [--out stage-b3]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", args.out ?? "stage-b3");
const VPS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));
const BASE = "http://localhost:4301/atlas-human-mobility/";

async function run() {
  const server = await preview({ root: join(HERE, ".."), preview: { port: 4301, strictPort: true } });
  const browser = await chromium.launch();
  const errors = [];
  for (const vp of VPS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${vp.label}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${vp.label}: ${m.text()}`); });
    const shot = (n) => page.screenshot({ path: join(dir, `${n}.png`) });
    const jump = async (id, p, wait = 500) => {
      await page.evaluate(([id, p]) => window.__atlas.jumpTo(id, p), [id, p]);
      await page.waitForTimeout(wait);
      // headless WebGL (SwiftShader) can stall frames; never capture a stage mid-fade
      await page.waitForFunction(() =>
        document.getAnimations().every((a) => !(a instanceof CSSAnimation && a.animationName === "stage-in" && a.playState === "running")) &&
        [...document.querySelectorAll(".stage-enter")].every((e) => getComputedStyle(e).opacity === "1") &&
        [...document.querySelectorAll(".deck-stage, .map-stage")].every((e) => !e.style.opacity || e.style.opacity === "0" || e.style.opacity === "1"),
        null, { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press("Escape");
    await jump("demand", 0.9, 1500);
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 20000 }).catch(() => errors.push(`${vp.label}: deck not ready`));
    // fixes 2 + 3: S05 chart labels, lab dims the map, smaller glow
    await jump("pressure", 0.5, 1500); await shot("05-pressure-b-lab-default");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.3, cm: 0.8 })); await page.waitForTimeout(900); await shot("05-pressure-c-lab-scenario");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.5, cm: 0.7, borough: "Queens" })); await page.waitForTimeout(900); await shot("05-pressure-d-extrapolated");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.3, cm: 0.9, borough: "Manhattan" }));
    // fixes 1 + 4: S06 ring fitted around the text, one-line chip
    await jump("futures", 0.5, 1500); await shot("06-futures-a-busier");
    await page.locator(".fut-select").getByRole("radio", { name: /A LANE LOST/ }).click(); await page.waitForTimeout(900); await shot("06-futures-b-lane");
    await page.locator(".fut-select").getByRole("radio", { name: /YOUR FUTURE/ }).click(); await page.waitForTimeout(900); await shot("06-futures-c-yours");
    // fix 6: rain answer wording
    await jump("evidence", 0.5, 1500); await shot("07-evidence-rain");
    // fix 5: OBS inspector clears the pill (M/T)
    await jump("observatory", 0, 2500);
    await page.evaluate(() => window.__atlas.setObs({ layer: "speed", region: { kind: "borough", name: "Queens" }, scale: "borough", selectedZone: 138 })); await page.waitForTimeout(2500); await shot("08-obs-b-inspector");
    await page.evaluate(() => window.__atlas.setObs({ layer: "network", region: null, scale: "city", selectedZone: 132, how: 18 + 4 * 24 })); await page.waitForTimeout(2500); await shot("08-obs-c-inspector-network");
    await ctx.close();

  }
  await browser.close();
  await server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  console.log("done", OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
