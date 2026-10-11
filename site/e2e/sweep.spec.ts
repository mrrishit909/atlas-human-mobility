/**
 * QA L19 sweep: the generated collision check (e2e/collide.ts) over every scene, at several progress points,
 * at all 12 variants: 7 required viewports, 1024x768 and 768x1024 with classic scrollbars, and the L2 laptop
 * sizes. Plus a negative control (a brand-new class must be caught) and D-060's per-glyph ink check.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { collisions } from "./collide";

type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void } };
const VARIANTS = [
  [1920, 1080, false], [1440, 900, false], [1024, 768, false], [768, 1024, false], [390, 844, false], [375, 812, false], [360, 800, false],
  [1024, 768, true], [768, 1024, true], [1280, 720, false], [1366, 768, false], [1440, 760, false],
] as const;
const STATES: [string, number[]][] = [
  ["city", [0.78]], ["anatomy", [0.14, 0.35, 0.5, 0.75]], ["rush-hour", [0.35, 0.65]], ["corridors", [0.1, 0.3, 0.55, 0.8, 0.88, 0.95]],
  ["demand", [0.65, 0.89, 0.99]], ["pressure", [0.2, 0.5]], ["futures", [0.5]], ["evidence", [0.2, 0.5, 0.8, 0.95]],
  ["observatory", [0]], ["closing", [0.9]],
];
const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";

test.beforeEach(({ isMobile }) => test.skip(!!isMobile, "variants are set inside each test"));

async function openVariant(playwright: { chromium: { launch: (o?: object) => Promise<Browser> } }, browser: Browser, baseURL: string, w: number, h: number, classic: boolean) {
  const b = classic ? await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] }) : browser;
  const ctx = await b.newContext({ baseURL, viewport: { width: w, height: h }, hasTouch: w < 1024 });
  if (classic) await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return { page, close: async () => { await ctx.close(); if (classic) await b.close(); } };
}
const jump = async (page: Page, id: string, p: number) => {
  await page.evaluate(([id, p]) => (window as unknown as Atlas).__atlas.jumpTo(id as string, p as number), [id, p] as const);
  await page.waitForTimeout(id === "corridors" ? 2400 : 1300);
};

for (const [w, h, classic] of VARIANTS) {
  const label = `${w}x${h}${classic ? "-classic" : ""}`;
  test(`L19 sweep: no generated text, control or chip box overlaps another in any scene (${label})`, async ({ playwright, browser }, info) => {
    test.setTimeout(420_000);
    const v = await openVariant(playwright, browser, info.project.use.baseURL!, w, h, classic);
    const bad: string[] = [];
    let boxes = 0;
    for (const [scene, ps] of STATES) for (const p of ps) {
      await jump(v.page, scene, p);
      const r = await collisions(v.page, `#${scene}`);
      boxes += r.boxes;
      bad.push(...r.hits.map((x) => `${scene}@${p}: ${x}`));
    }
    await v.close();
    expect(boxes, "boxes generated").toBeGreaterThan(300);
    expect(bad).toEqual([]);
  });
}

test("L19 negative control: an overlapping element with a brand-new class name is caught", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await jump(page, "corridors", 0.3);
  expect((await collisions(page, "#corridors")).hits).toEqual([]);
  const cls = `zz-probe-${Date.now().toString(36)}`;
  await page.evaluate((cls) => {
    const h2 = document.querySelector<HTMLElement>("#corridors .cor-text h2")!.getBoundingClientRect();
    const el = document.createElement("p");
    el.className = cls;
    el.textContent = "OVERLAP PROBE";
    el.style.cssText = `position:fixed; left:${h2.left + 10}px; top:${h2.top + 4}px; margin:0; font:400 14px monospace; color:#fff; z-index:50`;
    document.querySelector("#corridors .stage-content")!.appendChild(el);
  }, cls);
  const r = await collisions(page, "#corridors");
  expect(r.hits.some((x) => x.includes(cls)), r.hits.join("\n")).toBe(true);
});

/** QA D-060 / L16: every glyph of the dial title reads at 4.5:1 or better against what is behind it. */
for (const [w, h, classic] of [[1024, 768, false], [1024, 768, true], [1280, 720, false]] as const) test(`D-060: dial title ink is at least 4.5:1 per glyph at ${w}x${h}${classic ? " (classic scrollbar)" : ""}`, async ({ playwright, browser }, info) => {
  test.setTimeout(120_000);
  const v = await openVariant(playwright, browser, info.project.use.baseURL!, w, h, classic);
  for (const p of [0.8, 0.88, 0.95]) {
    await jump(v.page, "corridors", p);
    await v.page.waitForTimeout(900); // the title's entrance animation
    const png = (await v.page.screenshot()).toString("base64");
    const worst = await v.page.evaluate(async (png) => {
      const t = document.querySelector<HTMLElement>("#corridors .dial-title:not(.is-out)")!;
      const text = t.firstChild as Text;
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height), g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const sx = img.width / innerWidth;
      const lum = (r: number, gg: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
      let min = 99, at = "";
      for (let i = 0; i < text.length; i++) {
        if (!text.data[i]!.trim()) continue;
        const rg = document.createRange(); rg.setStart(text, i); rg.setEnd(text, i + 1);
        const r = rg.getBoundingClientRect();
        const d = g.getImageData(Math.round(r.left * sx), Math.round(r.top * sx), Math.max(1, Math.round(r.width * sx)), Math.max(1, Math.round(r.height * sx))).data;
        const ls: number[] = [];
        for (let k = 0; k < d.length; k += 4) ls.push(lum(d[k]!, d[k + 1]!, d[k + 2]!));
        ls.sort((a, b) => a - b);
        const hi = ls[Math.floor(ls.length * 0.95)]!, lo = ls[Math.floor(ls.length * 0.05)]!;
        const ratio = (hi + 0.05) / (lo + 0.05);
        if (ratio < min) { min = ratio; at = `"${text.data[i]}" #${i}`; }
      }
      return { min, at };
    }, png);
    expect(worst.min, `p ${p}: worst glyph ${worst.at}`).toBeGreaterThanOrEqual(4.5);
  }
  await v.close();
});

/** QA D-037 / L16: S04 direct labels read at 4.5:1 or better over the extrusions behind them. */
for (const [w, h] of [[1920, 1080], [1440, 900]] as const) test(`D-037: S04 label ink is at least 4.5:1 (${w}x${h})`, async ({ playwright, browser }, info) => {
  const v = await openVariant(playwright, browser, info.project.use.baseURL!, w, h, false);
  await jump(v.page, "demand", 0.6);
  await v.page.waitForFunction(() => !!(window as unknown as { __atlas: { mapApi?: () => unknown } }).__atlas.mapApi?.(), null, { timeout: 20000 });
  await jump(v.page, "demand", 0.89);
  await v.page.waitForTimeout(1500);
  const png = (await v.page.screenshot()).toString("base64");
  const res = await v.page.evaluate(async (png) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height), g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const sx = img.width / innerWidth;
    const lum = (r: number, gg: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
    return [...document.querySelectorAll<HTMLElement>(".dem-label")].filter((e) => getComputedStyle(e).display !== "none").map((e) => {
      const rg = document.createRange(); rg.selectNodeContents(e.firstChild!);
      const r = rg.getBoundingClientRect();
      const d = g.getImageData(Math.round(r.left * sx), Math.round(r.top * sx), Math.max(1, Math.round(r.width * sx)), Math.max(1, Math.round(r.height * sx))).data;
      const ls: number[] = [];
      for (let k = 0; k < d.length; k += 4) ls.push(lum(d[k]!, d[k + 1]!, d[k + 2]!));
      ls.sort((a, b) => a - b);
      return { t: e.textContent ?? "", ratio: (ls[Math.floor(ls.length * 0.95)]! + 0.05) / (ls[Math.floor(ls.length * 0.05)]! + 0.05) };
    });
  }, png);
  expect(res.length).toBeGreaterThan(0);
  for (const r of res) expect(r.ratio, r.t).toBeGreaterThanOrEqual(4.5);
  await v.close();
});

test("L19 whole document: an unlisted-class element overlapping the fixed chapter nav is caught from another scene's scope", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await jump(page, "corridors", 0.3);
  expect((await collisions(page, "#corridors")).hits).toEqual([]);
  const cls = `zz-nav-probe-${Date.now().toString(36)}`;
  await page.evaluate((cls) => {
    const n = document.querySelector(".nav-bar.is-fixed")!.getBoundingClientRect();
    const el = document.createElement("p");
    el.className = cls;
    el.textContent = "NAV OVERLAP PROBE";
    el.style.cssText = `position:fixed; left:${n.left + 20}px; top:${n.top + 8}px; margin:0; font:400 14px monospace; color:#fff; z-index:5`;
    document.body.appendChild(el);
  }, cls);
  const r = await collisions(page, "#corridors");
  expect(r.hits.some((x) => x.includes(cls)), r.hits.join("\n")).toBe(true);
});

// D-063: the S08 data credit and TLC disclaimer must stay clear of the fixed chapter nav, including at the true page bottom
for (const [w, h] of [[1280, 720], [1366, 768], [1024, 768], [1440, 900], [390, 844]] as const) {
  test(`D-063: S08 .end-foot is fully visible and clear of the fixed nav at the page bottom (${w}x${h})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press("Escape");
    await jump(page, "closing", 0.95);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(800);
    const g = await page.evaluate(() => {
      const f = document.querySelector<HTMLElement>(".end-foot")!.getBoundingClientRect();
      const nb = document.querySelector<HTMLElement>(".nav-bar.is-fixed, .nav-pill.is-fixed");
      const n = nb && getComputedStyle(nb).display !== "none" ? nb.getBoundingClientRect() : null;
      return { f: { t: f.top, b: f.bottom, l: f.left, r: f.right }, n: n && { t: n.top, b: n.bottom, l: n.left, r: n.right }, h: innerHeight, w: innerWidth, fs: parseFloat(getComputedStyle(document.querySelector(".end-foot")!).fontSize) };
    });
    expect(g.f.t, "footer top in view").toBeGreaterThanOrEqual(0);
    expect(g.f.b, "footer bottom in view").toBeLessThanOrEqual(g.h);
    expect(g.fs).toBeGreaterThanOrEqual(11);
    if (g.n) {
      const clear = g.f.b <= g.n.t - 4 || g.f.r <= g.n.l || g.f.l >= g.n.r;
      expect(clear, `footer ${JSON.stringify(g.f)} vs nav ${JSON.stringify(g.n)}`).toBe(true);
    }
    const r = await collisions(page, "#closing");
    expect(r.hits, `${w}x${h} S08 at page bottom`).toEqual([]);
  });
}
