#!/usr/bin/env node
/**
 * P01-FIX-005 evidence: the frames QA pass 5 cited (S03b LaGuardia title at every variant, S04 labels, CITY corners, S02 meta), at the 7 required viewports plus 1024x768 and 768x1024
 * with classic (layout) scrollbars, on the PRODUCTION build served at :4301 (npm run build, then vite preview).
 * Usage: node tests/capture-fix005.mjs [--only 1440x900,1024x768-classic]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "fix-005");
const BASE = "http://localhost:4301/atlas-human-mobility/";
const VPS = [
  ...[[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]].map(([width, height]) => ({ width, height, classic: false })),
  { width: 1024, height: 768, classic: true }, { width: 768, height: 1024, classic: true },
  { width: 1280, height: 720, classic: false }, { width: 1366, height: 768, classic: false }, { width: 1440, height: 760, classic: false },
].map((v) => ({ ...v, label: `${v.width}x${v.height}${v.classic ? "-classic" : ""}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));

const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";

async function run() {
  const plain = await chromium.launch();
  const classic = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  const errors = [];
  for (const vp of VPS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const browser = vp.classic ? classic : plain;
    const context = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1, ...opts });
      if (vp.classic) await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(`${vp.label}: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error" && !/500|Failed to load resource/.test(m.text())) errors.push(`${vp.label}: ${m.text()}`); });
      return { ctx, page };
    };
    const { ctx, page } = await context();
    const shot = (n) => page.screenshot({ path: join(dir, `${n}.png`) });
    const jump = async (id, p, wait = 900) => {
      await page.evaluate(([id, p]) => window.__atlas.jumpTo(id, p), [id, p]);
      await page.waitForTimeout(wait);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if (vp.classic) {
      const m = await page.evaluate(() => [document.documentElement.clientWidth, window.__atlas.vpClass(), matchMedia("(min-width: 1024px)").matches ? "D" : matchMedia("(min-width: 768px)").matches ? "T" : "M"]);
      if (m[0] >= vp.width || m[1] !== m[2]) errors.push(`${vp.label}: classic scrollbar not effective or class mismatch ${m}`);
    }
    await jump("city", 0.78); await shot("city-corners");
    for (const p of [0.8, 0.88, 0.95]) { await jump("corridors", p, 2600); await shot(`corridors-${p}-d060`); }
    await jump("demand", 0.6, 900);
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 20000 }).catch(() => {});
    await jump("demand", 0.89, 2500); await shot("demand-0.89-d037");
    await ctx.close();

    // D-042 / D-052: each failed artifact shows its own line + RETRY in the scene that needs it
    for (const [file, scene, p] of [["meta.json", "anatomy", 0.9]]) {
      const x = await context();
      await x.page.route(`**/data/${file}`, (r) => r.fulfill({ status: 500, body: "" }));
      await x.page.goto(BASE, { waitUntil: "networkidle" });
      await x.page.keyboard.press("Escape");
      await x.page.waitForTimeout(400);
      await x.page.evaluate(([s, p]) => window.__atlas.jumpTo(s, p), [scene, p]);
      await x.page.waitForTimeout(1500);
      await x.page.screenshot({ path: join(dir, `error-${file.replace(".json", "")}-${scene}-d061.png`) });
      await x.ctx.close();
    }
  }
  await plain.close();
  await classic.close();
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  console.log("done", OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
