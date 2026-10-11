#!/usr/bin/env node
/**
 * P01-QA-002 independent probe: intro frames, on-screen numbers, S04 blank-stage check, S08 echo,
 * S05 chip clipping, error/RETRY states, axe (normal + reduced motion), keyboard journey, reduced motion.
 * Usage: node qa-probe.mjs [part,part]   parts: intro,numbers,demand,closing,chip,errors,axe,keyboard,rm,wheel
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const BASE = "http://localhost:4301/atlas-human-mobility/";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/qa/probe";
mkdirSync(OUT, { recursive: true });
const PARTS = new Set((process.argv[2] ?? "intro,numbers,demand,closing,chip,errors,axe,keyboard,rm,wheel").split(","));
const resFile = join(OUT, "probe-results.json");
const results = existsSync(resFile) ? JSON.parse(readFileSync(resFile, "utf-8")) : {};
const save = () => writeFileSync(resFile, JSON.stringify(results, null, 1));
const load = () => execSync("uptime").toString().trim();
const SCENES = ["city", "anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence", "observatory", "closing"];

const browser = await chromium.launch({ headless: false });
async function ctx(vp, extra = {}) {
  const c = await browser.newContext({ viewport: vp, hasTouch: vp.width < 1024, deviceScaleFactor: 1, ...extra });
  const page = await c.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return { c, page, errors };
}
const settle = (page, ms) => page.waitForTimeout(ms);
const jump = async (page, id, p, ms = 1500) => { await page.evaluate(([i, q]) => window.__atlas.jumpTo(i, q), [id, p]); await settle(page, ms); };
async function boot(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  await settle(page, 400);
}

// ---------- intro frames ----------
if (PARTS.has("intro")) {
  results.intro = {};
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { c, page } = await ctx(vp);
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: "commit" });
    const rec = [];
    for (const t of [100, 600, 1200, 2000, 3000, 4000, 5000]) {
      const wait = t - (Date.now() - t0);
      if (wait > 0) await settle(page, wait);
      const info = await page.evaluate(() => {
        const vis = (el) => !!el && getComputedStyle(el).visibility !== "hidden" && +getComputedStyle(el).opacity > 0.05 && el.getBoundingClientRect().width > 0;
        const skip = [...document.querySelectorAll("button")].find((b) => /SKIP/i.test(b.textContent));
        const nav = document.querySelector("nav");
        const h1 = document.querySelector("h1[data-hero]");
        return { skipVisible: vis(skip), navVisible: vis(nav), h1Opacity: h1 ? getComputedStyle(h1).opacity : null };
      });
      await page.screenshot({ path: join(OUT, `intro-${vp.width}x${vp.height}-${t}ms.png`) });
      rec.push({ t, elapsedActual: Date.now() - t0, ...info });
    }
    results.intro[`${vp.width}x${vp.height}`] = rec;
    await c.close();
  }
  save();
}

// ---------- on-screen numbers vs facts.json ----------
if (PARTS.has("numbers")) {
  const { c, page, errors } = await ctx({ width: 1440, height: 900 });
  await boot(page);
  const text = {};
  const plan = [["city", 0.78], ["anatomy", 0.14], ["anatomy", 0.4], ["anatomy", 0.65], ["anatomy", 0.9], ["rush-hour", 0.35], ["corridors", 0.05], ["corridors", 0.3], ["corridors", 0.55], ["corridors", 0.8],
    ["demand", 0.89], ["pressure", 0.1], ["pressure", 0.4], ["futures", 0.1], ["evidence", 0.15], ["evidence", 0.35], ["evidence", 0.55], ["evidence", 0.75], ["evidence", 0.95], ["observatory", 0], ["closing", 0.95]];
  for (const [id, p] of plan) {
    await jump(page, id, p, id === "demand" ? 4000 : id === "closing" ? 3000 : 2200);
    text[`${id}@${p}`] = await page.evaluate((i) => document.getElementById(i)?.innerText ?? "", id);
  }
  results.numbersText = text; results.numbersErrors = errors;
  await c.close();
  save();
}

// ---------- S04 blank-stage check ----------
if (PARTS.has("demand")) {
  results.demand = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { c, page } = await ctx(vp);
    await boot(page);
    await jump(page, "corridors", 0.5, 2500);
    for (const p of [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.89]) {
      await jump(page, "demand", p, p === 0.45 ? 5000 : 2500);
      const st = await page.evaluate(() => ({
        deckOpacity: [...document.querySelectorAll(".map-stage, .deck-stage")].map((e) => getComputedStyle(e).opacity + "/" + getComputedStyle(e).visibility),
        ring: window.__atlasRing ? { ...window.__atlasRing } : null,
        canvases: [...document.querySelectorAll("canvas")].map((cv) => ({ cls: cv.className, op: getComputedStyle(cv).opacity, vis: getComputedStyle(cv).visibility, w: cv.width })),
      }));
      // pixel energy of the stage (right 2/3 of the viewport) to detect a blank frame
      const buf = await page.screenshot({ path: join(OUT, `demand-${vp.width}-p${p}.png`) });
      results.demand.push({ vp: `${vp.width}x${vp.height}`, p, ...st, pngBytes: buf.length });
    }
    // and while scrolling naturally through the track (wheel), sample frames
    await jump(page, "demand", 0.3, 1500);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 250); await settle(page, 350); await page.screenshot({ path: join(OUT, `demand-${vp.width}-wheel-${i}.png`) }); }
    await c.close();
  }
  save();
}

// ---------- S08 echo caption ----------
if (PARTS.has("closing")) {
  results.closing = {};
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { c, page } = await ctx(vp);
    await boot(page);
    await jump(page, "closing", 0.6, 1500);
    const rec = [];
    await jump(page, "closing", 0.95, 300);
    for (const t of [300, 1200, 2500, 4000]) {
      const cap = await page.evaluate(() => { const e = document.querySelector(".end-caption"); return e ? { text: e.innerText, top: e.getBoundingClientRect().top, op: getComputedStyle(e).opacity } : null; });
      rec.push({ t, cap });
      await page.screenshot({ path: join(OUT, `closing-${vp.width}-${t}ms.png`) });
      await settle(page, t === 300 ? 900 : t === 1200 ? 1300 : 1500);
    }
    // natural wheel scroll into the closing
    await jump(page, "closing", 0.5, 800);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 300); await settle(page, 400); }
    await settle(page, 2500);
    const capWheel = await page.evaluate(() => { const e = document.querySelector(".end-caption"); return e ? e.innerText : null; });
    await page.screenshot({ path: join(OUT, `closing-${vp.width}-after-wheel.png`) });
    results.closing[`${vp.width}x${vp.height}`] = { rec, capWheel };
    await c.close();
  }
  save();
}

// ---------- S05 chip clipping on phones ----------
if (PARTS.has("chip")) {
  results.chip = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    const { c, page } = await ctx(vp);
    await boot(page);
    await jump(page, "pressure", 0.5, 3000);
    const m = await page.evaluate(() => [...document.querySelectorAll(".chip--simulated, .lab-stage__fit, .lab-stage__head")].map((e) => {
      const r = e.getBoundingClientRect();
      return { cls: e.className, text: e.innerText, left: r.left, right: r.right, vw: innerWidth, scrollW: e.scrollWidth, clientW: e.clientWidth, overflowX: getComputedStyle(e).overflow, ws: getComputedStyle(e).whiteSpace };
    }));
    const chip = page.locator(".chip--simulated").first();
    if (await chip.count()) await page.locator(".lab-stage__head").first().screenshot({ path: join(OUT, `chip-${vp.width}.png`) }).catch(() => {});
    await page.screenshot({ path: join(OUT, `pressure-${vp.width}.png`) });
    results.chip.push({ vp: `${vp.width}x${vp.height}`, m });
    await c.close();
  }
  save();
}

// ---------- error + retry states ----------
if (PARTS.has("errors")) {
  results.errors = [];
  const cases = [["bpr_fit.json", "pressure", 0.5], ["zone_hour_week.json", "rush-hour", 0.35], ["zones.geojson", "demand", 0.89], ["od_top.json", "corridors", 0.3], ["facts.json", "city", 0.78], ["weather_model.json", "evidence", 0.55], ["od_matrix_totals.json", "observatory", 0], ["reconciliation.json", "evidence", 0.35]];
  for (const [file, id, p] of cases) {
    for (const vp of [{ width: 1440, height: 900 }]) {
      const { c, page, errors } = await ctx(vp);
      let block = true, hits = 0;
      await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.abort("failed") : r.continue(); });
      await boot(page);
      await jump(page, id, p, 3500);
      const sec = page.locator(`#${id}`);
      const errText = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
      await page.screenshot({ path: join(OUT, `error-${file}-${vp.width}.png`) });
      const retry = page.getByRole("button", { name: /^RETRY$/ }).first();
      const hasRetry = await retry.count() > 0 && await retry.isVisible().catch(() => false);
      let after = null, hitsBefore = hits;
      if (hasRetry) {
        block = false;
        await retry.click();
        await settle(page, 3500);
        after = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
        await page.screenshot({ path: join(OUT, `error-${file}-${vp.width}-after-retry.png`) });
      }
      results.errors.push({ file, scene: id, vp: `${vp.width}x${vp.height}`, alertText: errText, hasRetry, hitsBeforeRetry: hitsBefore, hitsAfterRetry: hits, alertsAfterRetry: after, consoleErrors: errors.slice(0, 5), sectionHasError: (await sec.innerText()).includes("COULD NOT LOAD") });
      await c.close();
    }
  }
  save();
}

// ---------- axe on every scene, normal + reduced motion, D and M ----------
if (PARTS.has("axe")) {
  results.axe = [];
  for (const rm of [false, true]) {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const { c, page } = await ctx(vp, rm ? { reducedMotion: "reduce" } : {});
      await boot(page);
      for (const id of SCENES) {
        if (rm) { await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: "instant" }), id); await settle(page, 1500); }
        else await jump(page, id, undefined, id === "demand" ? 4000 : 2000);
        const r = await new AxeBuilder({ page }).include(`#${id}`).analyze();
        results.axe.push({ rm, vp: `${vp.width}x${vp.height}`, scene: id, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").slice(0, 200)) })), passes: r.passes.length });
      }
      const nav = await new AxeBuilder({ page }).include("nav").analyze().catch(() => null);
      if (nav) results.axe.push({ rm, vp: `${vp.width}x${vp.height}`, scene: "nav", violations: nav.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })) });
      const full = await new AxeBuilder({ page }).analyze();
      results.axe.push({ rm, vp: `${vp.width}x${vp.height}`, scene: "WHOLE PAGE", violations: full.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").slice(0, 200)) })) });
      await c.close();
    }
  }
  save();
}

// ---------- keyboard-only journey ----------
if (PARTS.has("keyboard")) {
  const log = [];
  const { c, page, errors } = await ctx({ width: 1440, height: 900 });
  const focusInfo = () => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { tag: "BODY" };
    const cs = getComputedStyle(a), r = a.getBoundingClientRect();
    return { tag: a.tagName, role: a.getAttribute("role"), name: (a.getAttribute("aria-label") || a.innerText || a.getAttribute("placeholder") || "").slice(0, 60), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow.slice(0, 60), inView: r.bottom > 0 && r.top < innerHeight && r.width > 0, y: Math.round(r.top) };
  });
  await page.goto(BASE, { waitUntil: "commit" });
  await settle(page, 300);
  // intro skip by keyboard: first Tab stops
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Tab"); log.push({ step: `intro tab ${i + 1}`, f: await focusInfo() }); }
  await page.screenshot({ path: join(OUT, "kb-01-intro-tab.png") });
  await page.keyboard.press("Enter"); await settle(page, 600);
  log.push({ step: "Enter on intro focus", f: await focusInfo(), navShown: await page.evaluate(() => { const n = document.querySelector("nav"); return n ? getComputedStyle(n).opacity : null; }) });
  // Tab through the page from the top until the nav is reached, record order
  const order = [];
  for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); order.push(await focusInfo()); }
  log.push({ step: "first 30 tabs after intro", order });
  // focus the nav CORRIDORS button and activate with Enter
  const navBtn = page.getByRole("button", { name: "CORRIDORS", exact: true }).or(page.getByRole("link", { name: "CORRIDORS", exact: true })).first();
  await navBtn.focus(); await page.keyboard.press("Enter"); await settle(page, 1500);
  log.push({ step: "nav CORRIDORS Enter", f: await focusInfo(), hash: await page.evaluate(() => location.hash), scrollY: await page.evaluate(() => scrollY) });
  // S03b dial: Tab to the dial group and use arrows
  const dialEl = page.locator(".cor-hit");
  if (await dialEl.count()) {
    await dialEl.focus();
    const before = await page.locator(".cor-body").innerText().catch(() => "");
    await page.keyboard.press("ArrowRight"); await settle(page, 1500);
    const after = await page.locator(".cor-body").innerText().catch(() => "");
    await page.screenshot({ path: join(OUT, "kb-02-dial-arrow.png") });
    log.push({ step: "S03b dial ArrowRight", f: await focusInfo(), before, after, changed: before !== after });
  } else log.push({ step: "S03b dial", missing: true });
  // S03a controls: jump via nav (keyboard), Tab to WEEKEND radio
  await page.locator("nav.nav-bar").getByRole("link", { name: "RUSH HOUR", exact: true }).focus(); await page.keyboard.press("Enter"); await settle(page, 1500);
  const seq = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); seq.push(await focusInfo()); }
  log.push({ step: "S03a tab sequence after nav jump", seq });
  const wk = page.locator("#rush-hour [role=radiogroup]").first();
  if (await wk.count()) {
    await wk.locator("[aria-checked=true]").focus(); const r0 = await page.locator("#rush-hour").innerText();
    await page.keyboard.press("ArrowRight"); await settle(page, 1200);
    const r1 = await page.locator("#rush-hour").innerText();
    await page.screenshot({ path: join(OUT, "kb-03-rush-weekend.png") });
    log.push({ step: "S03a day radiogroup ArrowRight", changed: r0 !== r1, f: await focusInfo() });
  }
  // S04 HEIGHT
  await page.locator("nav.nav-bar").getByRole("link", { name: "DEMAND", exact: true }).focus(); await page.keyboard.press("Enter"); await settle(page, 4000);
  const hg = page.locator("#demand [role=radiogroup]").first();
  if (await hg.count()) {
    await hg.locator("[aria-checked=true]").focus(); await page.keyboard.press("ArrowRight"); await settle(page, 1500);
    await page.screenshot({ path: join(OUT, "kb-04-height-dropoffs.png") });
    log.push({ step: "S04 HEIGHT ArrowRight", checked: await hg.locator("[aria-checked=true]").innerText(), f: await focusInfo(), legend: await page.locator("#demand").innerText().then((t) => t.match(/HEIGHT = [^\n]+/)?.[0]) });
  }
  // S05 lab: sliders by keyboard
  await page.locator("nav.nav-bar").getByRole("link", { name: "PRESSURE", exact: true }).focus(); await page.keyboard.press("Enter"); await settle(page, 3000);
  const dm = page.locator("#pressure input[type=range]").first();
  if (await dm.count()) {
    await dm.focus(); for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); await settle(page, 1500);
    const res = await page.locator(".lab-result").innerText().catch(() => "");
    await page.screenshot({ path: join(OUT, "kb-05-lab-demand.png") });
    log.push({ step: "S05 DEMAND ArrowRight x4", f: await focusInfo(), res, live: await page.getByTestId("lab-live").innerText().catch(() => "") });
    const reset = page.locator("#pressure").getByRole("button", { name: /^RESET/ });
    await reset.focus(); await page.keyboard.press("Enter"); await settle(page, 1200);
    log.push({ step: "S05 RESET Enter", res: await page.locator(".lab-result").innerText().catch(() => ""), btn: await reset.innerText() });
    await dm.focus(); for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight"); await settle(page, 600);
  }
  // S06 futures radios
  await page.locator("nav.nav-bar").getByRole("link", { name: "FUTURES", exact: true }).focus(); await page.keyboard.press("Enter"); await settle(page, 2500);
  const fut = page.locator(".fut-select [role=radio]");
  const futInfo = [];
  for (let i = 0; i < await fut.count(); i++) futInfo.push({ name: (await fut.nth(i).innerText()).replace(/\n/g, " "), disabled: await fut.nth(i).getAttribute("aria-disabled"), checked: await fut.nth(i).getAttribute("aria-checked") });
  const checkedF = page.locator(".fut-select [aria-checked=true]");
  if (await checkedF.count()) { await checkedF.focus(); await page.keyboard.press("ArrowRight"); await settle(page, 1500); }
  await page.screenshot({ path: join(OUT, "kb-06-futures.png") });
  log.push({ step: "S06 futures radios", futInfo, afterArrow: await page.locator(".fut-select [aria-checked=true]").innerText().catch(() => ""), f: await focusInfo() });
  // OBS: search, inspector, explore/exit
  await page.locator("nav.nav-bar").getByRole("link", { name: "OBSERVATORY", exact: true }).focus(); await page.keyboard.press("Enter"); await settle(page, 4000);
  const search = page.getByRole("combobox");
  await search.focus(); await page.keyboard.type("JFK"); await settle(page, 400); await page.keyboard.press("Enter"); await settle(page, 2500);
  const insp = page.locator(".inspector");
  log.push({ step: "OBS search JFK + Enter", inspectorOpen: await insp.count() > 0, inspTitle: await insp.locator("#insp-title").innerText().catch(() => ""), f: await focusInfo() });
  await page.screenshot({ path: join(OUT, "kb-07-obs-inspector.png") });
  await page.keyboard.press("Escape"); await settle(page, 600);
  log.push({ step: "OBS Escape closes inspector", inspectorOpen: await insp.count() > 0, f: await focusInfo() });
  const y0 = await page.evaluate(() => scrollY);
  const ex = page.getByRole("button", { name: "EXPLORE", exact: true });
  await ex.focus(); await page.keyboard.press("Enter"); await settle(page, 1000);
  await page.keyboard.press("PageDown"); await settle(page, 600);
  const y1 = await page.evaluate(() => scrollY);
  await page.screenshot({ path: join(OUT, "kb-08-obs-explore.png") });
  log.push({ step: "EXPLORE Enter + PageDown", f: await focusInfo(), y0, y1, navOpacity: await page.evaluate(() => getComputedStyle(document.querySelector("nav")).opacity) });
  await page.keyboard.press("Escape"); await settle(page, 800);
  log.push({ step: "Escape exits EXPLORE", y2: await page.evaluate(() => scrollY), f: await focusInfo() });
  // obs scrubber slider with arrows
  const sl = page.locator(".obs-scrub-wrap");
  await sl.focus(); const v0 = await sl.getAttribute("aria-valuetext"); await page.keyboard.press("ArrowRight"); await settle(page, 400);
  log.push({ step: "OBS hour slider ArrowRight", v0, v1: await sl.getAttribute("aria-valuetext") });
  results.keyboard = { log, errors };
  await c.close();
  save();
}

// ---------- reduced motion composition ----------
if (PARTS.has("rm")) {
  results.rm = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { c, page, errors } = await ctx(vp, { reducedMotion: "reduce" });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await settle(page, 1500);
    await page.screenshot({ path: join(OUT, `rm-${vp.width}-first.png`) });
    const info = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight, vh: innerHeight,
      sticky: [...document.querySelectorAll("main *")].filter((e) => getComputedStyle(e).position === "sticky").length,
      blurred: [...document.querySelectorAll(".wr-word")].filter((e) => getComputedStyle(e).filter !== "none").length,
      motionAttr: document.documentElement.dataset.motion,
    }));
    for (const id of SCENES) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: "instant" }), id);
      await settle(page, id === "demand" ? 3500 : 1200);
      await page.screenshot({ path: join(OUT, `rm-${vp.width}-${id}.png`) });
    }
    const d0 = await page.evaluate(() => window.__atlasRing?.draws ?? null); await settle(page, 2000); const d1 = await page.evaluate(() => window.__atlasRing?.draws ?? null);
    results.rm.push({ vp: `${vp.width}x${vp.height}`, ...info, ringDrawsIdle: [d0, d1], errors });
    await c.close();
  }
  save();
}

// ---------- wheel over OBS map outside EXPLORE scrolls the page ----------
if (PARTS.has("wheel")) {
  const { c, page } = await ctx({ width: 1440, height: 900 });
  await boot(page);
  await jump(page, "observatory", 0, 4000);
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.move(1000, 500); await page.mouse.wheel(0, 400); await settle(page, 1200);
  const y1 = await page.evaluate(() => scrollY);
  results.wheel = { y0, y1, scrolled: y1 > y0 };
  await c.close();
  save();
}

results.machineLoad = load();
save();
await browser.close();
console.log("done");
