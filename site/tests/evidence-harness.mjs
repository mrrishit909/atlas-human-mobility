#!/usr/bin/env node
/**
 * P01 copy of the shared v2 harness. Only change: contact-sheet frames are 1fps and scaled to 240px tall
 * (the shared version tiles full-size frames and fails with 'Picture size invalid' on recordings over ~60s).
 * Reusable visual/motion evidence harness (see ~/documentation/PATTERNS.md).
 * Drives the built production site in real headed Chromium (headless has no
 * reliable GPU/WebGL, so headless frame numbers would misstate the device) and
 * produces the evidence the creative-website directive's requirement 9/10 asks
 * for: a screenshot of every scene + interaction state at the 7 required viewports (v2), a
 * full-scroll recording per viewport turned into an inspectable contact sheet,
 * and rAF frame-pacing stats during the heaviest interaction.
 *
 * Reads evidence.config.json (sibling file) for the project-specific scene
 * anchors, interaction steps, and the heavy-interaction trigger. Nothing about
 * scenes/selectors is hardcoded here, so this script is copy-and-reuse for
 * every later project in the directive -- only evidence.config.json changes.
 *
 * Usage (against a built+served production bundle, not `vite dev`):
 *   node tests/evidence-harness.mjs --base-url http://localhost:4173
 *
 * Outputs under artifacts/evidence/:
 *   screenshots/<width>/<scene-or-state>.png
 *   recordings/<width>.webm
 *   contact-sheets/<width>.png   (ffmpeg montage, 2fps, for Reading not watching)
 *   frame-pacing.json            (p50/p95/overBudget stats, device + throttle noted)
 */
import { chromium } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const ARTIFACTS = join(ROOT, "artifacts", "evidence");
// Exact viewports required by ~/CLAUDE.md + the Data Frontier directive (not width-derived heights).
const VIEWPORTS = [
  [1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800],
].map(([width, height]) => ({ width, height, label: `${width}x${height}` }));

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean)
);
const baseUrl = args["base-url"] ?? "http://localhost:4173";
const ONLY = args.only ? new Set(args.only.split(",")) : null; // e.g. --only 1440x900,390x844

const config = JSON.parse(readFileSync(join(HERE, "evidence.config.json"), "utf-8"));
// config: { scenes: [{id, anchorSelector}], interactionStates: [{id, setup: "js snippet run via page.evaluate"}],
//           heavyInteraction: { label, trigger: "js snippet", durationMs } }

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

async function captureScreenshotsAndRecording(browser, vp) {
  const width = vp.label; // directory/file key
  ensureDir(join(ARTIFACTS, "screenshots", String(width)));
  ensureDir(join(ARTIFACTS, "recordings"));
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.width < 800,
    recordVideo: { dir: join(ARTIFACTS, "recordings", `tmp-${width}`), size: { width: vp.width, height: vp.height } },
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.keyboard.press("Escape"); // skip the Opening overlay, same as the Playwright specs do
  await page.waitForTimeout(250);

  for (const scene of config.scenes) {
    await page.locator(scene.anchorSelector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // let scene-transition settle
    await page.screenshot({ path: join(ARTIFACTS, "screenshots", String(width), `scene-${scene.id}.png`) });
  }
  for (const state of config.interactionStates ?? []) {
    await page.evaluate(new Function(state.setup));
    await page.waitForTimeout(state.waitMs ?? 600);
    await page.screenshot({ path: join(ARTIFACTS, "screenshots", String(width), `state-${state.id}.png`) });
  }
  for (const seq of config.interactionSequences ?? []) {
    let i = 0;
    for (const step of seq.steps) {
      await page.evaluate(new Function(step.setup));
      await page.waitForTimeout(step.waitMs ?? 600);
      await page.screenshot({ path: join(ARTIFACTS, "screenshots", String(width), `seq-${seq.id}-${String(i++).padStart(2, "0")}.png`) });
    }
  }

  // Full scroll pass for the recording, smooth and slow enough to inspect.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = config.scrollSteps ?? 80;
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), (scrollHeight * i) / steps);
    await page.waitForTimeout(120);
  }

  const video = page.video();
  await context.close();
  if (video) {
    const savedPath = await video.path();
    renameSync(savedPath, join(ARTIFACTS, "recordings", `${width}.webm`));
  }
}

async function makeContactSheet(width) {
  ensureDir(join(ARTIFACTS, "contact-sheets"));
  const input = join(ARTIFACTS, "recordings", `${width}.webm`);
  const framesGlob = join(ARTIFACTS, "contact-sheets", `${width}-frame-%03d.png`);
  execFileSync(ffmpegPath, ["-y", "-i", input, "-vf", "fps=1,scale=-2:240", framesGlob], { stdio: "inherit" });
  const montage = join(ARTIFACTS, "contact-sheets", `${width}.png`);
  const n = readdirSync(join(ARTIFACTS, "contact-sheets")).filter((f) => f.startsWith(`${width}-frame-`)).length;
  const cols = Math.min(8, Math.max(1, n)), rows = Math.max(1, Math.ceil(n / cols)); // size grid from real frame count
  execFileSync(ffmpegPath, [
    "-y", "-pattern_type", "glob", "-i", join(ARTIFACTS, "contact-sheets", `${width}-frame-*.png`),
    "-filter_complex", `tile=${cols}x${rows}:margin=4:padding=4`, "-frames:v", "1", "-update", "1", montage,
  ], { stdio: "inherit" });
  console.log(`contact sheet: ${montage}`);
}

async function measureFramePacing(browser, { cpuThrottle, viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  if (cpuThrottle) await client.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__frameDeltas = [];
    let last = performance.now();
    function tick() {
      const now = performance.now();
      window.__frameDeltas.push(now - last);
      last = now;
      if (window.__keepSampling) requestAnimationFrame(tick);
    }
    window.__keepSampling = true;
    requestAnimationFrame(tick);
  });

  await page.keyboard.press("Escape");
  const check = config.heavyInteraction?.stateCheck ? new Function(`return (${config.heavyInteraction.stateCheck})`) : null;
  const before = check ? await page.evaluate(check) : null;
  const trigger = config.heavyInteraction?.trigger;
  if (trigger) await page.evaluate(new Function(trigger));
  await page.waitForTimeout(config.heavyInteraction?.durationMs ?? 4000);

  const deltas = await page.evaluate(() => { window.__keepSampling = false; return window.__frameDeltas; });
  const after = check ? await page.evaluate(check) : null;
  const stateChanged = check ? JSON.stringify(before) !== JSON.stringify(after) : null;
  if (check && !stateChanged) console.warn("WARNING: heavy interaction stateCheck unchanged; frame numbers may measure an idle page");
  await context.close();

  const sorted = [...deltas].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.floor(sorted.length * p)];
  const overBudgetFrac = (ms) => deltas.filter((d) => d > ms).length / deltas.length;
  return {
    label: `${viewport.width}x${viewport.height} ${cpuThrottle ? `${cpuThrottle}x CPU throttle` : "unthrottled"}`,
    stateChanged,
    sampleCount: deltas.length,
    p50_ms: pct(0.5), p95_ms: pct(0.95),
    pct_over_16_7ms: overBudgetFrac(16.7), pct_over_33ms: overBudgetFrac(33),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  for (const vp of VIEWPORTS.filter((v) => !ONLY || ONLY.has(v.label))) {
    console.log(`capturing ${vp.label}`);
    await captureScreenshotsAndRecording(browser, vp);
    await makeContactSheet(vp.label);
  }
  if (args["skip-pacing"]) { await browser.close(); return; }

  const deviceModel = execFileSync("sysctl", ["-n", "hw.model"]).toString().trim();
  const unthrottled = await measureFramePacing(browser, {});
  const throttled = await measureFramePacing(browser, { cpuThrottle: 4 });
  const mobile = await measureFramePacing(browser, { cpuThrottle: 4, viewport: { width: 390, height: 844 } });
  writeFileSync(join(ARTIFACTS, "frame-pacing.json"), JSON.stringify({
    device: deviceModel,
    heavyInteractionLabel: config.heavyInteraction?.label ?? "unspecified",
    measuredAt: new Date().toISOString(),
    runs: [unthrottled, throttled, mobile],
  }, null, 2));
  console.log(`frame pacing on ${deviceModel}:`, unthrottled, throttled, mobile);

  await browser.close();
}

main();
