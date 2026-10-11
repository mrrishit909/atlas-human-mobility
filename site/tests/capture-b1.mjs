#!/usr/bin/env node
/**
 * Stage B1 evidence: S00-S04 on the PRODUCTION build (dist/, in-process vite preview).
 * Usage: npm run build && node tests/capture-b1.mjs [--only 1440x900] [--out stage-b1]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", args.out ?? "stage-b1");
const VPS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));
const BASE = "http://localhost:4301/atlas-human-mobility/";
const hourP = (h) => 0.1 + ((h + 0.5) / 23.99) * 0.8;

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
      await page.waitForFunction(() => [...document.querySelectorAll(".stage-enter")].every((e) => getComputedStyle(e).opacity === "1"), null, { timeout: 10000 }).catch(() => {});
    };

    // S00 intro at four timepoints (first visit in a fresh session)
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    for (const [ms, n] of [[900, "a"], [1900, "b"], [3000, "c"], [5200, "d"]]) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      await shot(`00-intro-${n}-${ms}ms`);
    }
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);

    for (const [p, n] of [[0.2, "a"], [0.55, "b"], [0.92, "c"]]) { await jump("city", p); await shot(`01-city-${n}-p${p}`); }
    for (const [p, n] of [[0.06, "a"], [0.4, "b"], [0.8, "c"]]) { await jump("anatomy", p, 1100); await shot(`02-deck-${n}-p${p}`); }
    await jump("anatomy", 0.93, 600); await shot("02-deck-d-exit-to-orbit");
    for (const h of [8, 18]) { await jump("rush-hour", hourP(h), 900); await shot(`03a-rush-${String(h).padStart(2, "0")}h`); }
    await page.locator('[aria-label="Service"] [data-id="green"]').click(); await page.waitForTimeout(800); await shot("03a-rush-18h-green");
    await page.locator('[aria-label="Service"] [data-id="all"]').click();
    for (const [p, n] of [[0.1, "1-manhattan"], [0.37, "2-airports"], [0.62, "3-brooklyn"], [0.88, "4-hinge"]]) { await jump("corridors", p, 2400); await shot(`03b-dial-${n}`); }
    await jump("corridors", 0.1, 2200);
    await page.evaluate(() => { const a = window.__atlas; return a; });
    for (const [p, n] of [[0.2, "a"], [0.45, "b"], [0.6, "c"]]) { await jump("demand", p, 700); await shot(`04-morph-${n}-p${p}`); }
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 15000 }).catch(() => errors.push(`${vp.label}: deck not ready`));
    await jump("demand", 0.8, 2500); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await shot("04-map-d-landed");
    await jump("demand", 0.88, 1400); await shot("04-map-e-concentration");
    await jump("demand", 0.97, 1400); await shot("04-map-f-clusters");
    await ctx.close();

    // reduced motion: pinned tracks become normal flow with static frames
    if (vp.width !== 768) {
      const rmCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const rm = await rmCtx.newPage();
      await rm.goto(BASE, { waitUntil: "networkidle" });
      await rm.evaluate(() => document.fonts.ready);
      for (const id of ["anatomy", "rush-hour", "corridors", "demand"]) {
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
