#!/usr/bin/env node
/**
 * Stage A evidence: real screenshots of the dev gallery + app shell, taken from
 * the PRODUCTION preview (npm run build && npm run preview), never the dev server.
 * Usage: node tests/stage-a-capture.mjs [--base http://localhost:4301/atlas-human-mobility/] [--only 1440x900]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { preview } from "vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "stage-a");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const BASE = args.base ?? "http://localhost:4301/atlas-human-mobility/";
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));

const wait = (page, ms) => page.waitForTimeout(ms);
const jump = (page, id, p) => page.evaluate(([id, p]) => window.__atlas.jumpTo(id, p), [id, p]);
const call = (page, fn, ...a) => page.evaluate(([fn, a]) => void window.__atlas[fn](...a), [fn, a]); // never await the app promise

async function ready(page) {
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    serif: document.fonts.check('40px "Newsreader Variable"'),
    mono: document.fonts.check('13px "JetBrains Mono Variable"'),
  }));
  if (!fonts.serif || !fonts.mono) throw new Error(`fonts not loaded: ${JSON.stringify(fonts)}`);
}

/**
 * Loopback throttling proxy: Chromium's CDP network emulation does not slow
 * loopback in this setup, so the loading-state capture goes through a proxy
 * that streams data/*.geojson|json at ~48 KB/s. The request and its byte
 * progress are real; only the transport is slowed.
 */
function throttleProxy(target, port) {
  const t = new URL(target);
  const server = http.createServer((req, res) => {
    const up = http.request({ host: t.hostname, port: t.port, path: req.url, method: req.method, headers: { ...req.headers, host: t.host } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      if (!/\/data\//.test(req.url ?? "")) return r.pipe(res);
      // 4 KB every 85 ms (about 48 KB/s), written over time, not all at once
      const queue = [];
      let ended = false;
      r.on("data", (chunk) => { for (let i = 0; i < chunk.length; i += 4096) queue.push(chunk.subarray(i, i + 4096)); });
      r.on("end", () => { ended = true; });
      const pump = setInterval(() => {
        const next = queue.shift();
        if (next) res.write(next);
        else if (ended) { clearInterval(pump); res.end(); }
      }, 85);
      res.on("close", () => clearInterval(pump));
    });
    up.on("error", () => res.destroy());
    res.on("close", () => up.destroy());
    req.pipe(up);
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

async function run() {
  // In-process `vite preview` of the built dist/ (run `npm run build` first) unless --base points elsewhere.
  const server = args.base ? null : await preview({ root: join(HERE, ".."), build: { outDir: "dist-gallery" }, preview: { port: 4301, strictPort: true } }); // npm run build:gallery first
  const proxy = await throttleProxy(BASE, 4302);
  const SLOW = BASE.replace(/localhost:\d+|127\.0\.0\.1:\d+/, "127.0.0.1:4302");
  const browser = await chromium.launch();
  const log = [];
  for (const vp of VIEWPORTS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const external = [];
    page.on("request", (r) => { if (!/^http:\/\/(localhost|127\.0\.0\.1):43\d\d\//.test(r.url())) external.push(r.url()); });
    const shot = async (name) => { await page.screenshot({ path: join(dir, `${name}.png`) }); log.push(`${vp.label}/${name}.png`); };

    // Loading state: a real in-flight request under a throttled network (CDP), not a faked %.
    if (args.debug) page.on("requestfinished", (r) => console.log("finished", r.url(), Date.now() % 100000));
    await page.goto(`${SLOW}?gallery`, { waitUntil: "networkidle" });
    await ready(page);
    await jump(page, "g-ui", 0);
    await call(page, "loadGeo");
    if (args.debug) for (let i = 0; i < 6; i++) { await wait(page, 300); console.log(await page.evaluate(() => document.querySelector('[data-live="geo"]')?.textContent)); }
    await page.waitForFunction(() => /LOADING ZONES\.GEOJSON · [1-9]\d?%/.test(document.querySelector('[data-live="geo"]')?.textContent ?? ""), null, { timeout: 20000 });
    await wait(page, 400);
    await page.locator('[data-live="geo"]').scrollIntoViewIfNeeded();
    await shot("07-state-loading-live");

    await page.goto(`${BASE}?gallery`, { waitUntil: "networkidle" });
    await ready(page);

    await jump(page, "g-intro", 0); await call(page, "playIntro"); await wait(page, 500); await shot("01-intro-stub-revealing");
    await wait(page, 1600); await shot("01-intro-stub");
    for (const p of [0.25, 0.55, 0.9]) { await jump(page, "g-reveal", p); await wait(page, 450); await shot(`02-wordreveal-p${String(p).slice(2)}`); }
    await jump(page, "g-nav", 0); await wait(page, 500); await shot("03-nav-specimens");
    for (const [p, n] of [[0.06, "a-rise"], [0.39, "b-between"], [0.8, "c-last"]]) { await jump(page, "g-deck", p); await wait(page, 450); await shot(`04-deck-${n}`); }
    await jump(page, "g-orbs", 0); await wait(page, 500); await shot("05-orbs");
    await jump(page, "g-ring", 0); await call(page, "ringZoom", 0); await wait(page, 500); await shot("06-ring-r0");
    await call(page, "ringZoom", 0.5); await wait(page, 300); await shot("06-ring-zoom-half");
    await call(page, "ringZoom", 1); await wait(page, 300); await shot("06-ring-r1");
    await call(page, "ringStep"); await wait(page, 400); await shot("06-ring-mid-rotation");
    await wait(page, 1800); await shot("06-ring-r1-step2-settled");

    await jump(page, "g-ui", 0);
    await call(page, "loadGeo"); await call(page, "loadMissing"); await call(page, "replayNotes");
    await page.waitForSelector('[data-live="missing"] [role="alert"]');
    await wait(page, 2400); await shot("07-components-states");
    await page.locator('[data-live="missing"] button', { hasText: "RETRY" }).click();
    await page.waitForFunction(() => /ATTEMPT 2/.test(document.querySelector('[data-live="missing"]')?.textContent ?? ""));
    await page.locator('[data-live="missing"]').scrollIntoViewIfNeeded(); await wait(page, 450);
    await shot("07-state-error-after-retry");

    if (vp.width < 1024) {
      await page.locator(".nav-pill.is-fixed .menu-pill").click(); await wait(page, 450); await shot("08-mobile-menu-open");
      await page.keyboard.press("Escape"); await wait(page, 350);
    }

    // App shell (shipped route)
    const app = await ctx.newPage();
    app.on("request", (r) => { if (!/^http:\/\/(localhost|127\.0\.0\.1):43\d\d\//.test(r.url())) external.push(r.url()); });
    await app.goto(BASE, { waitUntil: "networkidle" });
    await ready(app);
    await app.waitForTimeout(250); await app.screenshot({ path: join(dir, "09-app-hero-intro.png") });
    await app.waitForTimeout(1800); await app.screenshot({ path: join(dir, "09-app-hero.png") });
    await app.evaluate(() => window.__atlas.jumpTo("corridors", 0.3)); await app.waitForTimeout(500);
    await app.screenshot({ path: join(dir, "09-app-corridors.png") });
    log.push(`${vp.label}/09-app-*.png`);
    if (vp.width < 1024) {
      await app.locator(".nav-pill.is-fixed .menu-pill").click(); await app.waitForTimeout(450);
      await app.screenshot({ path: join(dir, "09-app-menu-open.png") });
    }
    // Reduced motion: pinned tracks collapse to normal flow; deck becomes a vertical list
    const rmCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const rm = await rmCtx.newPage();
    await rm.goto(`${BASE}?gallery`, { waitUntil: "networkidle" });
    await ready(rm);
    await rm.evaluate(() => document.getElementById("g-deck").scrollIntoView());
    await rm.waitForTimeout(300);
    await rm.screenshot({ path: join(dir, "10-reduced-motion-deck.png") });
    log.push(`${vp.label}/10-reduced-motion-deck.png`);
    await rmCtx.close();

    if (external.length) throw new Error(`external requests: ${external.join(", ")}`);
    await ctx.close();
  }
  await browser.close();
  proxy.close();
  await server?.close();
  writeFileSync(join(OUT, "INDEX.txt"), `Stage A evidence, production preview ${BASE}\nCaptured ${new Date().toISOString()} (Playwright Chromium, DPR 1)\n\n${log.join("\n")}\n`);
  console.log(log.join("\n"));
}
run().catch((e) => { console.error(e); process.exit(1); });
