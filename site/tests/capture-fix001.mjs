#!/usr/bin/env node
/**
 * P01-FIX-001 evidence: every frame the QA defects touch, at the 7 required viewports on the PRODUCTION build (dist/, in-process vite preview).
 * Usage: npm run build && node tests/capture-fix001.mjs [--only 1440x900] [--out fix-001]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", args.out ?? "fix-001");
const VPS = [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
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

    // D-013: the first Tab during the intro lands on SKIP INTRO
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    await shot("d013-intro-first-tab");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // D-001 / D-002 / D-006: CITY landing (nav-jump state)
    await jump("city", 0.78, 900); await shot("d001-city-landing");
    await jump("rush-hour", 0.35, 1200); await shot("d001-rush-hour");
    for (const [p, n] of [[0.1, "manhattan"], [0.3, "airports"], [0.55, "brooklyn"], [0.88, "hinge"]]) { await jump("corridors", p, 2600); await shot(`d001-d003-corridors-${n}`); }
    await jump("demand", 0.6, 900);
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 20000 }).catch(() => errors.push(`${vp.label}: deck not ready`));
    await jump("demand", 0.65, 1500); await shot("d009-demand-p0.65");
    await jump("demand", 0.89, 2500); await shot("d004-demand-labels");
    await jump("pressure", 0.5, 1500); await shot("d008-d010-pressure-lab");
    await jump("pressure", 0.2, 1200); await shot("d010-pressure-observed");
    await jump("futures", 0.5, 1500); await shot("d001-d011-d020-futures");
    await jump("evidence", 0.5, 1500); await shot("d025-evidence");
    await ctx.close();

    // D-005: reduced motion, every scene in flow; S04 labels must not ride over S05 and nothing pans sideways
    const rm = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const rp = await rm.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" });
    for (const id of ["demand", "pressure"]) {
      await rp.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
      await rp.waitForTimeout(900);
      await rp.screenshot({ path: join(dir, `d005-reduced-motion-${id}.png`) });
      const [sw, cw] = await rp.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      if (sw > cw) errors.push(`${vp.label}: reduced motion ${id} scrollWidth ${sw} > ${cw}`);
    }
    await rm.close();
  }
  await browser.close();
  await server.close();
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  console.log("done", OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
