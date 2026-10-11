#!/usr/bin/env node
/**
 * Stage B2 evidence: S05-S08 + OBS, plus the B1 fixes (after) on the PRODUCTION build (dist/, in-process vite preview).
 * Usage: npm run build && node tests/capture-b1.mjs [--only 1440x900] [--out stage-b2]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", args.out ?? "stage-b2");
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

    // fixes (after): intro geo scale, M ledger, landed map at full opacity + quantile ramp
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(Math.max(0, 1900 - (Date.now() - t0)));
    await shot("fix3-intro-1900ms");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press("Escape");
    await jump("corridors", 0.1, 2400); await shot("fix4-dial-manhattan");
    await jump("demand", 0.6, 700);
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 20000 }).catch(() => errors.push(`${vp.label}: deck not ready`));
    await jump("demand", 0.8, 2500); await shot("fix1-2-map-landed");
    await jump("demand", 0.88, 1500); await shot("fix2-map-concentration");

    // S05 Pressure Lab
    await jump("pressure", 0.2, 1500); await shot("05-pressure-a-observed");
    await jump("pressure", 0.5, 1200); await shot("05-pressure-b-lab-default");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.3, cm: 0.8 })); await page.waitForTimeout(900); await shot("05-pressure-c-lab-scenario");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.5, cm: 0.7, borough: "Queens" })); await page.waitForTimeout(900); await shot("05-pressure-d-extrapolated");
    await page.evaluate(() => window.__atlas.setLab({ dm: 1.3, cm: 0.9, borough: "Manhattan" }));
    // S06 Futures
    await jump("futures", 0.5, 1200); await shot("06-futures-a-busier");
    await page.locator(".fut-select").getByRole("radio", { name: /A QUIETER CITY/ }).click(); await page.waitForTimeout(900); await shot("06-futures-b-quieter");
    await page.locator(".fut-select").getByRole("radio", { name: /YOUR FUTURE/ }).click(); await page.waitForTimeout(900); await shot("06-futures-c-yours");
    // S07 Evidence
    for (const [p, n] of [[0.1, "a"], [0.5, "b"], [0.96, "c"]]) { await jump("evidence", p, 1200); await shot(`07-evidence-${n}-p${p}`); }
    // OBS
    await jump("observatory", 0, 2500); await shot("08-obs-a-default");
    await page.evaluate(() => window.__atlas.setObs({ layer: "speed", region: { kind: "borough", name: "Queens" }, scale: "borough", selectedZone: 138 })); await page.waitForTimeout(2200); await shot("08-obs-b-speed-queens-inspector");
    await page.evaluate(() => window.__atlas.setObs({ layer: "network", region: null, scale: "city", selectedZone: 132, how: 18 * 1 + 4 * 24 })); await page.waitForTimeout(2200); await shot("08-obs-c-network-arcs");
    await page.evaluate(() => window.__atlas.setObs({ layer: "speed", compare: "future", selectedZone: null })); await page.waitForTimeout(1500); await shot("08-obs-d-compare-future");
    await page.evaluate(() => window.__atlas.setObs({ layer: "demand", compare: "observed", selectedZone: null, region: null, scale: "city", how: 56 }));
    // S08 Closing
    await jump("closing", 0.5, 1200); await shot("09-closing-a-p0.5");
    await jump("closing", 0.7, 400); await jump("closing", 0.9, 2600); await shot("09-closing-b-echo");
    await ctx.close();

    // reduced motion: pinned tracks become normal flow with static frames
    if (vp.width !== 768) {
      const rmCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const rm = await rmCtx.newPage();
      await rm.goto(BASE, { waitUntil: "networkidle" });
      await rm.evaluate(() => document.fonts.ready);
      for (const id of ["pressure", "futures", "evidence", "observatory", "closing"]) {
        await rm.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
        await rm.waitForTimeout(900);
        await rm.screenshot({ path: join(dir, `10-reduced-motion-${id}.png`) });
      }
      await rmCtx.close();
    }
  }
  await browser.close();
  await server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  console.log("done", OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
