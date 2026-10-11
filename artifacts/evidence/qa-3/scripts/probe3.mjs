#!/usr/bin/env node
// P01-QA-004 independent probe (pass 3; adapted from qa-2/scripts/probe2.mjs, adds classic-scrollbar variants). Usage: node probe2.mjs part,part
// parts: geom, tags, tickets, labels, rm, nav, axe, chip, s05s06, keyboard, errors
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
import AxeBuilder from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@axe-core/playwright/dist/index.mjs";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const BASE = "http://localhost:4301/atlas-human-mobility/";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-3/probe";
mkdirSync(OUT, { recursive: true });
const PARTS = new Set(process.argv[2].split(","));
const resFile = join(OUT, "probe-results.json");
const results = existsSync(resFile) ? JSON.parse(readFileSync(resFile, "utf-8")) : {};
const save = () => writeFileSync(resFile, JSON.stringify(results, null, 1));
const load = () => execSync("uptime").toString().trim().replace(/.*load averages?: /, "");
const SCENES = ["city", "anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence", "observatory", "closing"];
const ALL = [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]].map(([width, height]) => ({ width, height }));
const PHONES = ALL.filter((v) => v.width < 768);
const C1024 = { width: 1024, height: 768, classic: true }, C768 = { width: 768, height: 1024, classic: true };
const VARIANTS = [...ALL, C1024, C768];
const tag = (vp) => `${vp.width}x${vp.height}${vp.classic ? "-classic" : ""}`;
const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #666; } ::-webkit-scrollbar-track { background: #222; }";

// plain = default headless (scrollbars hidden, like overlay scrollbars); classic = headed Chromium (macOS gives it a layout scrollbar here) plus a forced 15px webkit scrollbar
const plainB = await chromium.launch();
const classicB = await chromium.launch({ headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] });
const browser = { close: async () => { await plainB.close(); await classicB.close(); } };
async function ctx(vp, extra = {}) {
  const b = vp.classic ? classicB : plainB;
  const c = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, isMobile: vp.width < 768, deviceScaleFactor: 1, ...extra });
  if (vp.classic) await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), SCROLLBAR_CSS);
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

// Visible text-line boxes of every leaf text node inside the section, plus overflow.
const collect = (page, id) => page.evaluate((id) => {
  const sec = document.getElementById(id);
  const out = [];
  const visOp = (el) => { let o = el, op = 1; while (o && o.nodeType === 1) { const cs = getComputedStyle(o); if (cs.display === "none" || cs.visibility === "hidden") return 0; op *= +cs.opacity; o = o.parentElement; } return op; };
  const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  let n, k = 0;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (el.closest("[aria-hidden=true]") || el.closest(".sr-only")) continue;
    if (visOp(el) < 0.1) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const cls = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
    // owner block: nearest ancestor that is a block-level box
    let blk = el; while (blk.parentElement && blk !== sec && getComputedStyle(blk).display.startsWith("inline")) blk = blk.parentElement;
    for (const q of r.getClientRects()) {
      if (q.width < 2 || q.height < 2 || q.bottom < 0 || q.top > innerHeight) continue;
      out.push({ t: n.textContent.trim().slice(0, 40), el: cls(el).slice(0, 60), blk: cls(blk).slice(0, 60), bid: k, l: Math.round(q.left), t0: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom) });
    }
    k++;
  }
  // collisions: different text nodes in different blocks whose line boxes overlap by more than 2px both ways
  const hits = [];
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    if (a.bid === b.bid) continue;
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t0, b.t0);
    if (ox > 2 && oy > 2) hits.push(`${a.t} [${a.el}] x ${b.t} [${b.el}] (${ox}x${oy})`);
  }
  const W = document.documentElement.clientWidth;
  const offscreen = out.filter((q) => q.l < -1 || q.r > W + 1).map((q) => `${q.t} [${q.el}] ${q.l}..${q.r}`);
  return { hits: [...new Set(hits)].slice(0, 25), offscreen: [...new Set(offscreen)].slice(0, 25), sw: document.documentElement.scrollWidth, cw: W };
}, id);

// ---------- generic collision + overflow at every viewport, every scene, 4 progress points ----------
if (PARTS.has("geom")) {
  results.geom = {};
  for (const vp of VARIANTS) {
    const { c, page, errors } = await ctx(vp);
    await boot(page);
    const env = await page.evaluate(() => ({ cw: document.documentElement.clientWidth, iw: innerWidth, js: window.__atlas.vpClass?.(), css: matchMedia("(min-width: 1024px)").matches ? "D" : matchMedia("(min-width: 768px)").matches ? "T" : "M" }));
    const rows = [];
    for (const id of SCENES) {
      for (const p of id === "observatory" ? [0] : [0.1, 0.35, 0.65, 0.9]) {
        await jump(page, id, p, id === "demand" || id === "observatory" ? 2600 : 1600);
        const g = await collect(page, id);
        const f = `geom-${tag(vp)}-${id}-${p}.png`;
        await page.screenshot({ path: join(OUT, f) });
        rows.push({ id, p, file: f, ...g });
      }
    }
    results.geom[tag(vp)] = { env, rows, errors, load: load() };
    console.log("geom", tag(vp));
    save();
    await c.close();
  }
}

// ---------- honesty tags visible on phones in every scene ----------
if (PARTS.has("tags")) {
  results.tags = [];
  for (const vp of VARIANTS) {
    const { c, page } = await ctx(vp);
    await boot(page);
    for (const [id, p] of [["city", 0.78], ["anatomy", 0.4], ["rush-hour", 0.35], ["corridors", 0.3], ["corridors", 0.9], ["demand", 0.89], ["pressure", 0.4], ["pressure", 0.8], ["futures", 0.5], ["evidence", 0.5], ["observatory", 0]]) {
      await jump(page, id, p, id === "demand" ? 3000 : 1600);
      const chips = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .chip`)].map((e) => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        let o = e, op = 1; while (o && o.nodeType === 1) { op *= +getComputedStyle(o).opacity; o = o.parentElement; }
        return { text: e.textContent.trim().slice(0, 60), shown: cs.display !== "none" && cs.visibility !== "hidden" && op > 0.5 && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.left >= -1 && r.right <= innerWidth + 1, l: Math.round(r.left), r: Math.round(r.right), occludedBy: (() => { if (!(r.width > 0 && r.bottom > 0 && r.top < innerHeight)) return null; const pts = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5]].map(([fx, fy]) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy)); const bad = pts.find((x) => x && !x.closest('.chip')); return bad ? (bad.tagName + '.' + String(bad.className).slice(0, 40) + ':' + (bad.textContent || '').trim().slice(0, 30)) : null; })() };
      }), id);
      const cards = id === "city" ? await page.evaluate(() => [...document.querySelectorAll(".city-cards .note")].map((n) => { const ch = n.querySelector(".chip"); const r = ch?.getBoundingClientRect(); return { text: n.textContent.slice(0, 50), chip: ch?.textContent, chipVisible: !!r && r.width > 0 && getComputedStyle(ch).display !== "none" }; })) : undefined;
      const f = `tags-${tag(vp)}-${id}-${p}.png`;
      await page.screenshot({ path: join(OUT, f) });
      results.tags.push({ vp: tag(vp), id, p, visibleChips: chips.filter((x) => x.shown).map((x) => x.text), hiddenChips: chips.filter((x) => !x.shown), occluded: chips.filter((x) => x.shown && x.occludedBy).map((x) => `${x.text} <- ${x.occludedBy}`), cards, file: f });
    }
    await c.close();
  }
  save();
}

// ---------- tickets at D/T ----------
if (PARTS.has("tickets")) {
  results.tickets = [];
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, C1024, C768]) {
    const { c, page } = await ctx(vp);
    await boot(page);
    for (const p of [0.1, 0.2, 0.3, 0.45, 0.55, 0.7, 0.88]) {
      for (const band of [null, "AM PEAK", "PM PEAK", "LATE NIGHT"]) {
        await jump(page, "corridors", p, band ? 200 : 2600);
        if (band) {
          const g = page.locator(".cor-text .cor-bands, .cor-bands-m").filter({ visible: true }).getByRole("radio", { name: band }).first();
          if (!(await g.count())) continue;
          await g.click(); await settle(page, 2600);
        }
        const t = await page.evaluate(() => [...document.querySelectorAll("#corridors .ticket")].filter((e) => { const cs = getComputedStyle(e); return cs.display !== "none" && +cs.opacity > 0.05; }).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, top: r.top, b: r.bottom, text: e.textContent.trim(), sw: e.scrollWidth, cw: e.clientWidth }; }));
        const W = await page.evaluate(() => document.documentElement.clientWidth);
        t.sort((a, b) => a.l - b.l);
        const bad = [];
        t.forEach((x, i) => {
          if (x.l < 15.5) bad.push(`left ${x.l.toFixed(1)} ${x.text}`);
          if (x.r > W - 15.5) bad.push(`right ${x.r.toFixed(1)}>${W - 16} ${x.text}`);
          if (x.sw > x.cw + 1) bad.push(`clipped text ${x.text}`);
          for (let j = 0; j < i; j++) { const y = t[j]; const vOver = Math.min(x.b, y.b) - Math.max(x.top, y.top) > 0; if (vOver && x.l - y.r < 7.5) bad.push(`gap ${(x.l - y.r).toFixed(1)} ${y.text} | ${x.text}`); }
        });
        const f = `tickets-${tag(vp)}-${p}-${band ?? "ALL"}.png`.replace(/ /g, "_");
        if (!band || bad.length) await page.screenshot({ path: join(OUT, f) });
        results.tickets.push({ vp: tag(vp), p, band: band ?? "ALL", n: t.length, texts: t.map((x) => x.text), bad, file: (!band || bad.length) ? f : null });
      }
      const all = page.locator(".cor-text .cor-bands, .cor-bands-m").filter({ visible: true }).getByRole("radio", { name: "ALL" }).first();
      if (await all.count()) await all.click();
    }
    await c.close();
  }
  save();
}

// ---------- S04 labels on phones (and all) ----------
if (PARTS.has("labels")) {
  results.labels = [];
  for (const vp of VARIANTS) {
    const { c, page } = await ctx(vp);
    await boot(page);
    await jump(page, "demand", 0.6, 3000);
    await page.waitForFunction(() => !!window.__atlas.mapApi?.(), null, { timeout: 30000 }).catch(() => {});
    for (const metric of [null, "DROPOFFS", "NET"]) {
      await jump(page, "demand", 0.89, 3000);
      if (metric) { const r = page.locator('[role=radiogroup][aria-label="Height metric"] [role=radio]', { hasText: metric }).first(); if (await r.count()) { await r.click(); await settle(page, 2500); } }
      const l = await page.evaluate(() => [...document.querySelectorAll(".dem-label")].filter((e) => getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), sw: e.scrollWidth, cw: e.clientWidth }; }));
      const W = await page.evaluate(() => document.documentElement.clientWidth);
      const bad = l.filter((x) => x.l < 15.5 || x.r > W - 15.5 || x.sw > x.cw + 1).map((x) => `${x.text} ${x.l}..${x.r}`);
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const a = l[i], b = l[j]; if (Math.min(a.r, b.r) > Math.max(a.l, b.l) && Math.min(a.b, b.b) > Math.max(a.t, b.t)) bad.push(`overlap ${a.text} | ${b.text}`); }
      const f = `labels-${tag(vp)}-${metric ?? "PICKUPS"}.png`;
      await page.screenshot({ path: join(OUT, f) });
      results.labels.push({ vp: tag(vp), metric: metric ?? "PICKUPS", labels: l.map((x) => `${x.text} [${x.l}..${x.r}]`), bad, file: f });
    }
    await c.close();
  }
  save();
}

// ---------- reduced motion: overflow + label leaks at all 7 viewports ----------
if (PARTS.has("rm")) {
  results.rm = [];
  for (const vp of VARIANTS) {
    const { c, page, errors } = await ctx(vp, { reducedMotion: "reduce" });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await settle(page, 1200);
    const info = await page.evaluate(() => ({ motion: document.documentElement.dataset.motion, sticky: [...document.querySelectorAll("main *")].filter((e) => getComputedStyle(e).position === "sticky").length, blurred: [...document.querySelectorAll(".wr-word")].filter((e) => getComputedStyle(e).filter !== "none").length }));
    const rows = [];
    for (const id of SCENES) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: "instant" }), id);
      await settle(page, id === "demand" || id === "observatory" ? 3000 : 1200);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, leaked: [...document.querySelectorAll(".dem-label")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== "hidden" && !e.closest("#demand")?.contains(document.elementFromPoint(r.left + 1, r.top + 1)); }).length, wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 5).map((e) => e.tagName + "." + String(e.className).slice(0, 40)) }));
      const g = await collect(page, id);
      const f = `rm-${tag(vp)}-${id}.png`;
      await page.screenshot({ path: join(OUT, f) });
      rows.push({ id, ...m, hits: g.hits, offscreen: g.offscreen, file: f });
    }
    // also scroll through every 300px and record max scrollWidth
    let maxSw = 0; const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await settle(page, 60); maxSw = Math.max(maxSw, await page.evaluate(() => document.documentElement.scrollWidth)); }
    results.rm.push({ vp: tag(vp), ...info, docH: H, maxScrollWidth: maxSw, rows, errors });
    console.log("rm", tag(vp));
    await c.close();
  }
  save();
}

// ---------- nav jumps: landing state + axe after every jump (D-006) ----------
if (PARTS.has("nav")) {
  results.nav = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, C1024, { width: 390, height: 844 }]) {
    const { c, page } = await ctx(vp);
    await boot(page);
    const phone = vp.width < 768;
    for (const id of ["observatory", "city", "corridors", "pressure", "anatomy", "futures", "evidence", "demand", "rush-hour", "city"]) {
      if (phone) {
        await page.locator(".nav-pill.is-fixed .menu-pill").click(); await settle(page, 400);
        await page.locator(`#menu-panel a[href="#${id}"]`).click();
      } else await page.getByRole("navigation", { name: "Chapters", exact: true }).locator(`a[href="#${id}"]`).click();
      await settle(page, 450);
      const st = await page.evaluate((id) => ({
        hash: location.hash, active: document.activeElement?.tagName + ":" + (document.activeElement?.textContent ?? "").slice(0, 40),
        ghosts: [...document.querySelectorAll(`#${id} .wr-word`)].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) return false; let o = e, op = 1; while (o && o.nodeType === 1) { op *= +getComputedStyle(o).opacity; o = o.parentElement; } if (op < 0.05) return false; const cs = getComputedStyle(e); return +cs.opacity < 1 || (cs.filter !== "none" && cs.filter !== ""); }).map((e) => e.textContent),
        secTop: Math.round(document.getElementById(id).getBoundingClientRect().top),
      }), id);
      const f = `nav-${tag(vp)}-${id}.png`;
      await page.screenshot({ path: join(OUT, f) });
      await settle(page, 1200);
      const ax = await new AxeBuilder({ page }).analyze();
      results.nav.push({ vp: tag(vp), id, ...st, file: f, axe: ax.violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`) });
    }
    await c.close();
  }
  save();
}

// ---------- axe per section, normal + reduced motion, 1440 + 390 ----------
if (PARTS.has("axe")) {
  results.axe = [];
  for (const rm of [false, true]) for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, C1024, { width: 390, height: 844 }]) {
    const { c, page } = await ctx(vp, rm ? { reducedMotion: "reduce" } : {});
    await boot(page);
    for (const id of SCENES) {
      for (const p of rm ? [null] : [0.15, 0.5, 0.9]) {
        if (rm) { await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: "instant" }), id); await settle(page, 1500); }
        else await jump(page, id, id === "observatory" ? 0 : p, id === "demand" ? 3500 : 1800);
        const r = await new AxeBuilder({ page }).include(`#${id}`).analyze();
        results.axe.push({ rm, vp: tag(vp), scene: id, p, violations: r.violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").slice(0, 160)).join(" | ")}`) });
        if (id === "observatory") break;
      }
    }
    const full = await new AxeBuilder({ page }).analyze();
    results.axe.push({ rm, vp: tag(vp), scene: "WHOLE PAGE", violations: full.violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}`) });
    await c.close();
  }
  save();
}

// ---------- S05 chip at all viewports ----------
if (PARTS.has("chip")) {
  results.chip = [];
  for (const vp of VARIANTS) {
    const { c, page } = await ctx(vp);
    await boot(page);
    for (const p of [0.5, 0.8]) {
      await jump(page, "pressure", p, 2500);
      const m = await page.evaluate(() => [...document.querySelectorAll("#pressure .chip")].filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), sw: e.scrollWidth, cw: e.clientWidth, W: document.documentElement.clientWidth }; }));
      const f = `chip-${tag(vp)}-${p}.png`;
      await page.screenshot({ path: join(OUT, f) });
      results.chip.push({ vp: tag(vp), p, chips: m, bad: m.filter((x) => x.r > x.W - 15.5 || x.l < 0 || x.sw > x.cw + 1), file: f, sw: await page.evaluate(() => document.documentElement.scrollWidth) });
    }
    await c.close();
  }
  save();
}

// ---------- S05 two speeds, S06 callout across hours ----------
if (PARTS.has("s05s06")) {
  const { c, page } = await ctx({ width: 1440, height: 900 });
  await boot(page);
  const out = {};
  for (const p of [0.1, 0.2, 0.3, 0.4, 0.55, 0.7, 0.85]) { await jump(page, "pressure", p, 2200); out[`pressure@${p}`] = await page.locator("#pressure").innerText(); await page.screenshot({ path: join(OUT, `s05-1440-${p}.png`) }); }
  for (const p of [0.1, 0.5, 0.9]) { await jump(page, "futures", p, 2200); out[`futures@${p}`] = await page.locator("#futures").innerText(); await page.screenshot({ path: join(OUT, `s06-1440-${p}.png`) }); }
  results.s05s06 = out;
  await c.close();
  save();
}

// ---------- keyboard-only journey ----------
if (PARTS.has("keyboard")) {
  const log = [];
  const { c, page, errors } = await ctx({ width: 1440, height: 900 });
  const fi = () => page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return "BODY"; const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return `${a.tagName}${a.getAttribute("role") ? "[" + a.getAttribute("role") + "]" : ""} "${(a.getAttribute("aria-label") || a.innerText || "").slice(0, 40).replace(/\n/g, " ")}" inView=${r.bottom > 0 && r.top < innerHeight} outline=${cs.outlineStyle}/${cs.outlineWidth}`; });
  await page.goto(BASE, { waitUntil: "commit" });
  await settle(page, 500);
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Tab"); log.push({ step: `intro tab ${i + 1}`, f: await fi() }); }
  await page.screenshot({ path: join(OUT, "kb-01-intro.png") });
  // go back to SKIP INTRO and activate
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
  log.push({ step: "shift-tab back", f: await fi() });
  await page.keyboard.press("Enter"); await settle(page, 800);
  log.push({ step: "Enter (skip intro)", f: await fi(), introGone: await page.evaluate(() => !document.querySelector(".nav-bar.is-hidden")) });
  // skip-to-chapters link
  await page.goto(BASE, { waitUntil: "commit" }); await settle(page, 500);
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  log.push({ step: "tab 2 on fresh load", f: await fi() });
  await page.keyboard.press("Enter"); await settle(page, 800);
  log.push({ step: "Enter on SKIP TO CHAPTERS", f: await fi() });
  await page.keyboard.press("Tab"); log.push({ step: "next Tab", f: await fi() });
  const navLink = async (id) => { await page.getByRole("navigation", { name: "Chapters", exact: true }).locator(`a[href="#${id}"]`).focus(); await page.keyboard.press("Enter"); await settle(page, 1800); };
  await navLink("rush-hour");
  const seq = []; for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); seq.push(await fi()); }
  log.push({ step: "RUSH HOUR via nav Enter, then 6 Tabs", seq });
  await navLink("corridors");
  const d = page.locator(".cor-hit"); await d.focus(); const b0 = await page.locator("#corridors").innerText();
  await page.keyboard.press("ArrowRight"); await settle(page, 1600); const b1 = await page.locator("#corridors").innerText();
  await page.screenshot({ path: join(OUT, "kb-02-dial.png") });
  log.push({ step: "S03b dial ArrowRight", changed: b0 !== b1, f: await fi() });
  await navLink("futures");
  const g = page.locator(".fut-select");
  log.push({ step: "S06 tabstops", tab0: await g.locator("[role=radio][tabindex='0']").count(), radios: await g.locator("[role=radio]").count() });
  await g.locator("[aria-checked=true]").focus(); const c0 = await g.locator("[aria-checked=true]").innerText();
  await page.keyboard.press("ArrowRight"); await settle(page, 1200); const c1 = await g.locator("[aria-checked=true]").innerText();
  await page.keyboard.press("ArrowRight"); await settle(page, 1200); const c2 = await g.locator("[aria-checked=true]").innerText();
  await page.keyboard.press("ArrowRight"); await settle(page, 1200); const c3 = await g.locator("[aria-checked=true]").innerText();
  await page.keyboard.press("ArrowLeft"); await settle(page, 1200); const c4 = await g.locator("[aria-checked=true]").innerText();
  await page.screenshot({ path: join(OUT, "kb-03-futures.png") });
  log.push({ step: "S06 arrows R,R,R,L", seq: [c0, c1, c2, c3, c4].map((s) => s.replace(/\n/g, " ")), f: await fi() });
  await navLink("pressure");
  const sl = page.locator("#pressure input[type=range]").first();
  if (await sl.count()) { await sl.focus(); for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight"); await settle(page, 1200); log.push({ step: "S05 slider ArrowRight x3", f: await fi(), res: (await page.locator(".lab-result").innerText().catch(() => "")).replace(/\n/g, " ") }); await page.screenshot({ path: join(OUT, "kb-04-lab.png") }); }
  await navLink("futures");
  const yours = g.getByRole("radio", { name: /YOUR FUTURE/ });
  log.push({ step: "YOUR FUTURE after lab change", disabled: await yours.getAttribute("aria-disabled") });
  await navLink("observatory");
  const s = page.getByRole("combobox"); await s.focus(); await page.keyboard.type("JFK"); await settle(page, 400); await page.keyboard.press("Enter"); await settle(page, 2200);
  log.push({ step: "OBS search JFK Enter", inspector: await page.locator(".inspector").count(), f: await fi() });
  await page.screenshot({ path: join(OUT, "kb-05-obs.png") });
  await page.keyboard.press("Escape"); await settle(page, 600);
  log.push({ step: "Esc", inspector: await page.locator(".inspector").count(), f: await fi() });
  results.keyboard = { log, errors };
  await c.close();
  save();
}

// ---------- error + RETRY by route blocking ----------
if (PARTS.has("errors")) {
  results.errors = [];
  const cases = [["facts.json", "city", 0.78], ["facts.json", "anatomy", 0.5], ["facts.json", "rush-hour", 0.35], ["facts.json", "corridors", 0.3], ["facts.json", "demand", 0.89], ["facts.json", "pressure", 0.5], ["facts.json", "evidence", 0.35], ["facts.json", "closing", 0.9], ["zones_index.json", "city", 0.78], ["od_ring_top.json", "city", 0.5], ["od_ring_top.json", "corridors", 0.3], ["zone_month.json", "demand", 0.89], ["network.json", "observatory", 0], ["daily.json", "evidence", 0.55], ["meta.json", "evidence", 0.15], ["zone_hour_week.json", "rush-hour", 0.35], ["od_top.json", "corridors", 0.3], ["zones.geojson", "demand", 0.89], ["bpr_fit.json", "pressure", 0.5], ["bpr_fit.json", "futures", 0.5], ["reconciliation.json", "anatomy", 0.5], ["weather_model.json", "evidence", 0.55], ["clusters.json", "evidence", 0.75], ["od_matrix_totals.json", "observatory", 0]];
  for (const [file, id, p] of cases) for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    if (vp.width === 390 && !(["facts.json", "bpr_fit.json", "zones.geojson", "od_ring_top.json"].includes(file) && ["city", "pressure", "demand", "corridors"].includes(id))) continue;
    const { c, page, errors } = await ctx(vp);
    let block = true, hits = 0;
    await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.abort("failed") : r.continue(); });
    await boot(page);
    await jump(page, id, p, 3500);
    if (id === "observatory") { await page.evaluate(() => window.__atlas.setObs?.({})); }
    const alerts = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    const where = await page.evaluate((id) => [...document.querySelectorAll(".state-error, [role=alert]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return { sec: e.closest("section")?.id, live: e.getAttribute("role") === "alert" || !!e.querySelector("[role=alert]"), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, text: e.textContent.trim().slice(0, 60) }; }), id);
    const ownInView = where.some((w) => w.sec === id && w.inView);
    const f = `error-${file}-${id}-${vp.width}.png`;
    await page.screenshot({ path: join(OUT, f) });
    const modelChips = await page.locator(`#${id} .lab-stage .chip--simulated, #${id} .lab-stage .chip--derived`).count();
    const retry = page.locator(`#${id}`).getByRole("button", { name: /RETRY/ }).first();
    const hasRetry = (await retry.count()) > 0 && (await retry.isVisible().catch(() => false));
    const hb = hits; let after = null;
    if (hasRetry) { block = false; await retry.click(); await settle(page, 3500); after = await page.locator('[role="alert"]').allInnerTexts().catch(() => []); await page.screenshot({ path: join(OUT, `error-${file}-${id}-${vp.width}-retry.png`) }); }
    results.errors.push({ file, id, vp: tag(vp), alerts, where, ownInView, nAlertsForFile: alerts.filter((a) => a.toUpperCase().includes(file.toUpperCase())).length, modelChips, hasRetry, hitsBefore: hb, hitsAfter: hits, alertsAfter: after, file_png: f, console: errors.slice(0, 3) });
    await c.close();
  }
  save();
}

if (PARTS.has("numbers")) {
  const { c, page } = await ctx({ width: 1440, height: 900 });
  await boot(page);
  const text = {};
  for (const [id, p] of [["city", 0.5], ["city", 0.78], ["city", 0.95], ["anatomy", 0.14], ["anatomy", 0.4], ["anatomy", 0.65], ["anatomy", 0.9], ["rush-hour", 0.35], ["rush-hour", 0.8], ["corridors", 0.05], ["corridors", 0.3], ["corridors", 0.55], ["corridors", 0.8], ["demand", 0.3], ["demand", 0.89], ["evidence", 0.15], ["evidence", 0.35], ["evidence", 0.55], ["evidence", 0.75], ["evidence", 0.95], ["observatory", 0], ["closing", 0.95]]) {
    await jump(page, id, p, id === "demand" ? 3500 : id === "closing" ? 3000 : 2000);
    text[`${id}@${p}`] = await page.evaluate((i) => document.getElementById(i)?.innerText ?? "", id);
  }
  results.numbersText = text;
  await c.close();
  save();
}

results[`load_${[...PARTS].join("_")}`] = load();
save();
await browser.close();
console.log("done", [...PARTS].join(","));
