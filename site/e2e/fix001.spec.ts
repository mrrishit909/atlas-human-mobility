/**
 * P01-FIX-001: one verification test per QA defect (docs/QA_REPORT.md). Viewports are set per test;
 * these run on the desktop project only (the mobile project would repeat them).
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { collisions } from "./collide";

const ALL = [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]] as const;
const DT = ALL.filter(([w]) => w >= 768);
const PHONES = ALL.filter(([w]) => w < 768);
type R = { left: number; top: number; right: number; bottom: number; name?: string };
type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void; mapApi?: () => unknown; setObs: (p: object) => void } };

test.beforeEach(({ isMobile }) => test.skip(!!isMobile, "viewports are set inside each test"));

async function open(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
const jump = async (page: Page, id: string, p: number, wait = 900) => {
  await page.evaluate(([id, p]) => (window as unknown as Atlas).__atlas.jumpTo(id as string, p as number), [id, p] as const);
  await page.waitForTimeout(wait);
};
const overlap = (a: R, b: R, slack = 0) => a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack;

/**
 * Ring-vs-text is asserted at 1024x768, the composition D-001 reported. At 1440 and 1920 the
 * ambient S01 ring deliberately runs behind the display type at low alpha (approved in B1);
 * text-vs-text and text-vs-card are asserted at every viewport.
 */
const RING_CHECKED = (w: number, h: number) => (w === 1024 && h === 768) || (w === 768 && h === 1024);
const ringGeom = (page: Page, w: number, h: number) => (RING_CHECKED(w, h) ? page.evaluate(() => window.__atlasRing?.geom ?? null) : Promise.resolve(null));

async function d001Scenes(page: Page, w: number, h: number, tag = "") {
  // boxes are generated from the DOM (QA L19): every text run, control and chip in the scene
  const check = async (scene: string, label: string) => {
    const r = await collisions(page, `#${scene}`, await ringGeom(page, w, h));
    expect(r.boxes, `${label}: boxes found`).toBeGreaterThan(3);
    expect(r.hits, `${w}x${h}${tag} ${label}`).toEqual([]);
  };
  await open(page, w, h);
  await jump(page, "city", 0.78);
  await check("city", "S01");
  await jump(page, "rush-hour", 0.35, 1200);
  await check("rush-hour", "S03a");
  // every dial anchor, including the LaGuardia step at 0.8 / 0.88 / 0.95 where a third chip appears (QA D-047, D-060)
  for (const p of [0.1, 0.3, 0.55, 0.8, 0.88, 0.95]) {
    await jump(page, "corridors", p, 2400);
    await check("corridors", `S03b p${p}`);
  }
}

async function d001Futures(page: Page, w: number, h: number, tag = "") {
  await open(page, w, h);
  await jump(page, "futures", 0.5, 1500);
  const bb = JSON.parse((await page.locator(".fut-canvas").getAttribute("data-bbox"))!) as number[];
  const ring = { left: bb[0]!, top: bb[1]!, right: bb[2]!, bottom: bb[3]! };
  const r = await collisions(page, "#futures");
  expect(r.hits, `${w}x${h}${tag} S06`).toEqual([]);
  const blocks = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#futures .stage-content > :not(canvas):not(.fut-canvas)")].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none" && !e.classList.contains("sr-only")).map((e) => { const x = e.getBoundingClientRect(); return { name: e.className, left: x.left, top: x.top, right: x.right, bottom: x.bottom }; }));
  for (const b of blocks) expect(overlap(ring, b), `${w}x${h}${tag}: ring vs ${b.name}`).toBe(false);
  // T and D: the minute bars are real bars, not 1px ticks (QA D-033 at 768)
  const bars = await page.locator("#futures .fut-bar").evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").map((e) => (e as HTMLElement).offsetWidth));
  for (const bw of bars) expect(bw, `${w}x${h}${tag}: fut-bar track width`).toBeGreaterThan(80);
}

for (const [w, h] of ALL) test(`D-001: no text collides with text or cards, or the ring at 1024x768 and 768x1024, in S01, S03a, S03b (${w}x${h})`, async ({ page }) => {
  test.setTimeout(180_000);
  await d001Scenes(page, w, h);
});

// L2 laptop sizes (QA D-057): the S03b title must clear the column and the ticket row here too
for (const [w, h] of [[1280, 720], [1366, 768], [1440, 760]] as const) test(`D-057: no text collides in S01, S03a, S03b at ${w}x${h}`, async ({ page }) => {
  test.setTimeout(180_000);
  await d001Scenes(page, w, h);
});

test("D-001: the S06 split ring never intersects a text block (all 7 viewports)", async ({ page }) => {
  test.setTimeout(180_000);
  for (const [w, h] of ALL) await d001Futures(page, w, h);
});

/**
 * D-033: the same collision checks with classic (layout) scrollbars, as on Windows Chrome/Edge.
 * Headless Chromium hides scrollbars by default; this browser keeps them, and the page gets a 15px gutter.
 */
for (const [w, h] of [[1024, 768], [768, 1024]] as const) test(`D-033: with classic scrollbars, JS and CSS agree on the composition and nothing collides (${w}x${h})`, async ({ playwright }, info) => {
  test.setTimeout(300_000);
  const b = await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const ctx = await b.newContext({ baseURL: info.project.use.baseURL, viewport: { width: w, height: h } });
    await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style");
      st.textContent = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";
      document.head.appendChild(st);
    }));
    const page = await ctx.newPage();
    await open(page, w, h);
    const m = await page.evaluate(() => ({
      cw: document.documentElement.clientWidth,
      js: (window as unknown as { __atlas: { vpClass: () => string } }).__atlas.vpClass(),
      css: matchMedia("(min-width: 1024px)").matches ? "D" : matchMedia("(min-width: 768px)").matches ? "T" : "M",
    }));
    expect(m.cw, "a classic scrollbar takes layout width").toBeLessThan(w);
    expect(m.js, "JS viewport class equals the CSS media-query class").toBe(m.css);
    await d001Scenes(page, w, h, " classic");
    await d001Futures(page, w, h, " classic");
  } finally {
    await b.close();
  }
});

test("D-002: every S01 number card shows its honesty tag on phones", async ({ page }) => {
  for (const [w, h] of PHONES) {
    await open(page, w, h);
    await jump(page, "city", 0.78);
    const cards = await page.locator(".city-cards .note").evaluateAll((els) => els.map((e) => {
      const chip = e.querySelector<HTMLElement>(".chip");
      const r = chip?.getBoundingClientRect();
      return { text: e.textContent, chip: !!chip && getComputedStyle(chip).display !== "none" && !!r && r.width > 0 && r.height > 0 };
    }));
    expect(cards.length).toBe(2);
    for (const c of cards) expect(c.chip, `${w}: ${c.text}`).toBe(true);
  }
});

for (const [w, h] of DT) test(`D-003: destination tickets never overlap each other or leave the viewport, every anchor and two bands (${w}x${h})`, async ({ page }) => {
  test.setTimeout(150_000);
  let seen = 0;
  {
    await open(page, w, h);
    for (const p of [0.1, 0.3, 0.55, 0.88]) {
      await jump(page, "corridors", p, 2600);
      for (const band of [null, "PM PEAK"] as const) {
        if (band) { await page.locator(".cor-text .cor-bands, .cor-bands-m").filter({ visible: true }).getByRole("radio", { name: band }).first().click(); await page.waitForTimeout(2600); }
        const t = await page.locator("#corridors .ticket").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, text: e.textContent }; }));
        const W = await page.evaluate(() => document.documentElement.clientWidth);
        seen += t.length; // the Manhattan state has none: every destination sits on the visible arc
        t.sort((a, b) => a.left - b.left);
        t.forEach((x, i) => {
          expect(x.left, `${w} p${p} ${band}: ${x.text}`).toBeGreaterThanOrEqual(15.5);
          expect(x.right, `${w} p${p} ${band}: ${x.text}`).toBeLessThanOrEqual(W - 15.5);
          if (i) expect(x.left - t[i - 1]!.right, `${w} p${p} ${band}: gap before ${x.text}`).toBeGreaterThanOrEqual(7.5);
        });
      }
      if (await page.locator(".cor-text .cor-bands, .cor-bands-m").filter({ visible: true }).count()) await page.locator(".cor-text .cor-bands, .cor-bands-m").filter({ visible: true }).getByRole("radio", { name: "ALL" }).first().click();
    }
  }
  expect(seen, "tickets rendered somewhere").toBeGreaterThan(0);
});

test("D-004: S04 direct labels stay inside the viewport on phones", async ({ page }) => {
  test.setTimeout(150_000);
  for (const [w, h] of PHONES) {
    await open(page, w, h);
    await jump(page, "demand", 0.6);
    await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
    await jump(page, "demand", 0.89, 2500);
    const labels = await page.locator(".dem-label").evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, text: e.textContent }; }));
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect(l.left, `${w}: ${l.text}`).toBeGreaterThanOrEqual(15.5);
      expect(l.right, `${w}: ${l.text}`).toBeLessThanOrEqual(w - 15.5);
    }
  }
});

const SCENES = ["city", "anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence", "observatory", "closing"];
for (const rm of [false, true]) {
  test(`D-005: no sideways scroll in any scene at 360/375/390 (${rm ? "reduced motion" : "normal motion"})`, async ({ browser }) => {
    test.setTimeout(240_000);
    for (const [w, h] of PHONES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: rm ? "reduce" : "no-preference", hasTouch: true });
      const page = await ctx.newPage();
      await page.goto("", { waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      for (const id of SCENES) {
        if (rm) await page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), id);
        else await page.evaluate((id) => (window as unknown as Atlas).__atlas.jumpTo(id, 0.5), id);
        await page.waitForTimeout(700);
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(sw, `${w} ${id}`).toBeLessThanOrEqual(cw);
        if (rm) {
          const leaked = await page.locator(".dem-label").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden").length);
          expect(leaked, `${w} ${id}: S04 labels visible under reduced motion`).toBe(0);
        }
      }
      await ctx.close();
    }
  });
}

test("D-006: every nav jump lands fully resolved, and axe passes after each jump", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 1440, 900);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  for (const [label, id] of [["CITY", "city"], ["ANATOMY", "anatomy"], ["RUSH HOUR", "rush-hour"], ["CORRIDORS", "corridors"], ["DEMAND", "demand"], ["PRESSURE", "pressure"], ["FUTURES", "futures"], ["EVIDENCE", "evidence"], ["OBSERVATORY", "observatory"], ["CITY", "city"]]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await page.waitForTimeout(400);
    const ghosts = await page.locator(`#${id} .wr-word`).evaluateAll((els) => els.filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) return false;
      let o: Element | null = e; let op = 1;
      while (o) { op *= Number(getComputedStyle(o).opacity); o = o.parentElement; }
      if (op < 0.05) return false; // not shown at this progress (e.g. the shrunk S01 headline)
      const cs = getComputedStyle(e);
      return Number(cs.opacity) < 1 || (cs.filter !== "none" && cs.filter !== "");
    }).map((e) => e.textContent));
    expect(ghosts, `${label}: half-revealed words`).toEqual([]);
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`), `axe after ${label}`).toEqual([]);
  }
});

test("D-008: the S05 SIMULATED chip fits inside the viewport at all 7 viewports", async ({ page }) => {
  test.setTimeout(150_000);
  for (const [w, h] of ALL) {
    await open(page, w, h);
    await jump(page, "pressure", 0.5, 1500);
    const chip = page.locator(".lab-stage__head .chip--simulated");
    await expect(chip).toBeVisible({ timeout: 15000 });
    const m = await chip.evaluate((e) => ({ right: e.getBoundingClientRect().right, sw: e.scrollWidth, cw: e.clientWidth, W: document.documentElement.clientWidth }));
    expect(m.right, `${w}`).toBeLessThanOrEqual(m.W - 15.5);
    expect(m.sw, `${w}`).toBeLessThanOrEqual(m.cw + 1);
  }
});

test("D-009: the S04 stage is never blank across the handoff (p 0.60 to 0.70)", async ({ page }) => {
  test.setTimeout(180_000);
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    await open(page, w, h);
    await jump(page, "demand", 0.6);
    await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
    for (let p = 0.6; p <= 0.7001; p += 0.005) {
      await jump(page, "demand", p, 450);
      // a black stage compresses to about 3 KB; the map or the morph is tens of KB
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: Math.round(h * 0.6) } });
      expect(png.length, `${w} p=${p.toFixed(3)}`).toBeGreaterThan(12_000);
    }
  }
});

test("D-010: the S05 statement's 48% and the lab's Manhattan speed are both named", async ({ page, request }) => {
  const fit = await (await request.get("data/bpr_fit.json")).json();
  const facts = await (await request.get("data/facts.json")).json();
  const mn = fit.boroughs.Manhattan;
  const b = mn.baseline[2 * 24 + facts.am_peak_hour.hour];
  await open(page, 1440, 900);
  await jump(page, "pressure", 0.2, 1200);
  const note = page.getByTestId("speed-defs");
  await expect(note).toContainText(`${Math.round(facts.borough_am_peak_speed_ratio.Manhattan.speed_ratio_pct)}% IS THE MEDIAN ZONE SPEED`);
  await expect(note).toContainText(`${(Math.round(b.median_speed_mph * 10) / 10).toFixed(1)} MPH AT WED ${String(facts.am_peak_hour.hour).padStart(2, "0")}:00, ${Math.round((100 * b.median_speed_mph) / mn.free_flow_mph)}% OF`);
});

test("D-012: the S06 futures radiogroup uses arrows and a single Tab stop", async ({ page }) => {
  await open(page, 1440, 900);
  await jump(page, "futures", 0.5, 1200);
  const group = page.locator(".fut-select");
  expect(await group.locator("[role=radio][tabindex='0']").count()).toBe(1);
  await group.locator("[aria-checked=true]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: /A LANE LOST/ })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: /A LANE LOST/ })).toBeFocused();
});

test("D-013: the first Tab during the intro lands on SKIP INTRO", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "SKIP TO CHAPTERS" })).toBeFocused();
});

test("D-014 + D-015: one live region per failed artifact; no model chip without a model", async ({ page }) => {
  await page.route("**/data/facts.json", (r) => r.fulfill({ status: 500, body: "" }));
  await page.route("**/data/bpr_fit.json", (r) => r.fulfill({ status: 500, body: "" }));
  await open(page, 1440, 900);
  await jump(page, "pressure", 0.5, 1500);
  for (const f of ["FACTS.JSON", "BPR_FIT.JSON"]) expect(await page.locator("[role=alert]", { hasText: `COULD NOT LOAD ${f}` }).count(), f).toBe(1);
  expect(await page.locator(".lab-stage .chip--simulated, .lab-stage .chip--derived").count()).toBe(0);
});

test("D-017: a favicon is served and nothing 404s", async ({ page }) => {
  const bad: string[] = [];
  page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await open(page, 1440, 900);
  const href = await page.locator("link[rel=icon]").getAttribute("href");
  expect(href).toBeTruthy();
  expect((await page.request.get(new URL(href!, page.url()).href)).status()).toBe(200);
  expect(bad).toEqual([]);
});

test("phones: the layout viewport never widens during load, so an early jump lands at its progress", async ({ browser }) => {
  // found during FIX-001: the observatory scrub defaulted to 1440x900, which widened a phone's layout viewport
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  const r = await page.evaluate(() => {
    const iw = innerWidth;
    (window as unknown as Atlas).__atlas.jumpTo("rush-hour", 0.5);
    return { iw, p: (window as unknown as { __atlas: { getProgress: (id: string) => number } }).__atlas.getProgress("rush-hour") };
  });
  expect(r.iw).toBe(390);
  expect(r.p).toBeCloseTo(0.5, 2);
  await ctx.close();
});

/* ---------------- P01-FIX-002 (QA pass 2) ---------------- */

/** Visible chips (non-zero box, inside the viewport, not display:none) in a scene. */
const visibleChips = (page: Page, id: string) => page.evaluate((id) => [...document.querySelectorAll<HTMLElement>(`#${id} .chip`)].filter((c) => {
  const r = c.getBoundingClientRect();
  let o: HTMLElement | null = c; let op = 1;
  while (o) { op *= Number(getComputedStyle(o).opacity); o = o.parentElement; }
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.left >= 0 && r.right <= innerWidth && op > 0.5;
}).map((c) => (c.textContent ?? "").trim()), id);

for (const [w, h] of PHONES) test(`D-030/D-031/D-032: every data visual keeps its honesty tag on phones (${w}x${h})`, async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, w, h);
  await jump(page, "rush-hour", 0.35, 1200);
  expect((await visibleChips(page, "rush-hour")).join(" | "), "S03a ring").toContain("OBSERVED");
  await jump(page, "corridors", 0.3, 2400);
  const cor = (await visibleChips(page, "corridors")).join(" | ");
  expect(cor, "S03b chords").toContain("OBSERVED");
  expect(cor, "S03b pulses").toContain("PULSES");
  await jump(page, "futures", 0.5, 1500);
  const fut = (await visibleChips(page, "futures")).join(" | ");
  expect(fut, "S06 observed half, worded for the rotated split").toContain("OBSERVED · TOP HALF");
  expect(fut).toContain("SIMULATED");
  await jump(page, "observatory", 0, 1000);
  // the observatory's title block waits for its data (zone_hour_week.json, about 500 KB)
  await expect.poll(async () => (await visibleChips(page, "observatory")).join(" | "), { message: "OBS heights and flows", timeout: 20000 }).toMatch(/OBSERVED.*FLOWS|FLOWS.*OBSERVED/);
});

for (const [w, h] of PHONES) test(`D-035: S02 card 3 text blocks never overprint each other (${w}x${h})`, async ({ page }) => {
  await open(page, w, h);
  await jump(page, "anatomy", 0.5, 1500);
  // generated boxes (QA L19): every text run, control and chip of the shown card (card 3)
  const r = await collisions(page, "#anatomy .story-card[data-active]");
  expect(r.boxes).toBeGreaterThan(10);
  expect(r.hits).toEqual([]);
  const inside = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>("#anatomy .story-card[data-active]")!;
    const cb = c.getBoundingClientRect().bottom;
    return [...c.querySelectorAll<HTMLElement>("*")].every((e) => e.getBoundingClientRect().bottom <= cb + 0.5);
  });
  expect(inside, "every element inside the card").toBe(true);
});

for (const [w, h] of ALL) test(`D-039: S04 direct labels are pairwise disjoint in every metric (${w}x${h})`, async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, w, h);
  await jump(page, "demand", 0.6);
  await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
  await jump(page, "demand", 0.89, 2500);
  for (const metric of ["PICKUPS", "DROPOFFS", "NET"]) {
    await page.locator("#demand button", { hasText: new RegExp(`^${metric}$`) }).first().click();
    await page.waitForTimeout(1500);
    const r = await page.locator(".dem-label").evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").map((e) => { const b = e.getBoundingClientRect(); return { name: e.textContent ?? "", left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }));
    expect(r.length, `${metric}: at least the rank-1 label`).toBeGreaterThan(0);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) expect(overlap(r[i]!, r[j]!), `${metric}: ${r[i]!.name} vs ${r[j]!.name}`).toBe(false);
  }
});

for (const [w, h] of [[1440, 900], [390, 844]] as const) test(`D-041: a facts.json failure is announced and recoverable on CITY (${w}x${h})`, async ({ page }) => {
  let block = true;
  await page.route("**/data/facts.json", (r) => (block ? r.fulfill({ status: 500, body: "" }) : r.continue()));
  await open(page, w, h);
  await jump(page, "city", 0.78, 1200);
  const alert = page.locator("[role=alert]", { hasText: "COULD NOT LOAD FACTS.JSON" });
  await expect(alert).toHaveCount(1);
  await expect(alert).toBeInViewport();
  expect(await alert.evaluate((e) => e.closest("section")?.id)).toBe("city");
  block = false;
  await alert.getByRole("button", { name: /RETRY/ }).click();
  await expect(page.locator(".city-cards .note")).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator("[role=alert]", { hasText: "FACTS.JSON" })).toHaveCount(0);
});

test("D-038: the skip link has a target", async ({ page }) => {
  await open(page, 1440, 900);
  expect(await page.locator("#chapters").count()).toBe(1);
});

test("D-043: S06 states the borough moved most and least, bound to the minutes list", async ({ page }) => {
  await open(page, 1440, 900);
  await jump(page, "futures", 0.5, 1500);
  const rows = await page.locator("#futures .fut-deltas li").evaluateAll((els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()));
  const line = (await page.getByTestId("fut-line").textContent()) ?? "";
  const parsed = rows.map((r) => r.match(/^(.*?) ?([+-]\d+\.\d) MIN/)!).map((m) => ({ b: m[1]!.trim(), d: m[2]! }));
  expect(parsed).toHaveLength(5);
  parsed.sort((a, b) => Math.abs(Number(b.d)) - Math.abs(Number(a.d)));
  expect(line.toUpperCase()).toContain(`${parsed[0]!.b} ${parsed[0]!.d} MIN A TRIP, THE MOST`);
  expect(line.toUpperCase()).toContain(`${parsed[4]!.b} ${parsed[4]!.d}, THE LEAST`);
});

/* ---------------- P01-FIX-003 (QA pass 3) ---------------- */

// every artifact surfaces its own error + RETRY where it is missing (QA D-042, D-052)
for (const [file, scene, p, layer] of [
  ["od_ring_top.json", "city", 0.78, null],
  ["od_ring_top.json", "corridors", 0.3, null],
  ["meta.json", "anatomy", 0.5, null],
  ["meta.json", "evidence", 0.5, null],
  ["network.json", "observatory", 0, "NETWORK"],
] as const) test(`D-042/D-052: a ${file} failure is announced and recoverable in ${scene}`, async ({ page }) => {
  let block = true;
  let hits = 0;
  await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.fulfill({ status: 500, body: "" }) : r.continue(); });
  await open(page, 1440, 900);
  await jump(page, scene, p, 1500);
  if (layer) {
    await page.locator("#observatory").getByRole("radio", { name: layer, exact: true }).first().click();
    await page.waitForTimeout(800);
    // no model chip over a model that did not load (the D-015 pattern)
    await expect(page.locator("#observatory .obs-title .chip", { hasText: "PAGERANK" })).toHaveCount(0);
  }
  const alert = page.locator("[role=alert]", { hasText: `COULD NOT LOAD ${file.toUpperCase()}` });
  await expect(alert).toHaveCount(1, { timeout: 10000 });
  await expect(alert).toBeInViewport();
  expect(await alert.evaluate((e) => e.closest("section")?.id)).toBe(scene);
  block = false;
  const before = hits;
  await alert.getByRole("button", { name: /RETRY/ }).click();
  await expect(page.locator("[role=alert]", { hasText: file.toUpperCase() })).toHaveCount(0, { timeout: 10000 });
  expect(hits).toBe(before + 1);
  if (layer) await expect(page.locator("#observatory .obs-title .chip", { hasText: "PAGERANK" })).toHaveCount(1);
});

/* ---------------- P01-FIX-004 (QA pass 4) ---------------- */

test("D-054: the S02 meta.json line is live only while card 3 is the shown card", async ({ page }) => {
  await page.route("**/data/meta.json", (r) => r.fulfill({ status: 500, body: "" }));
  await open(page, 1440, 900);
  await jump(page, "anatomy", 0.14, 1500);
  expect(await page.locator("[role=alert]", { hasText: "META.JSON" }).count(), "card 1 shown").toBe(0);
  await jump(page, "anatomy", 0.5, 1500);
  const a = page.locator("[role=alert]", { hasText: "META.JSON" });
  await expect(a).toHaveCount(1);
  await expect(a).toBeInViewport();
});

for (const [w, h] of [[768, 1024], [390, 844], [375, 812], [360, 800]] as const) test(`D-051/D-034: S07 cards never cover "How we know." and holdout triplets stay on one line (${w}x${h})`, async ({ page }) => {
  await open(page, w, h);
  for (const p of [0.35, 0.5, 0.65, 0.8, 0.95]) {
    await jump(page, "evidence", p, 1200);
    const r = await page.evaluate(() => {
      const hd = document.querySelector<HTMLElement>("#evidence .ev-head h2")!.getBoundingClientRect();
      const cards = [...document.querySelectorAll<HTMLElement>("#evidence .ev-ex:not([aria-hidden=true]) .ev-card")].filter((c) => getComputedStyle(c.closest(".ev-ex")!).display !== "none" && Number(getComputedStyle(c.closest(".ev-ex")!).opacity) > 0.05).map((c) => c.getBoundingClientRect());
      const hit = cards.some((c) => c.left < hd.right && hd.left < c.right && c.top < hd.bottom && hd.top < c.bottom);
      const trip = [...document.querySelectorAll<HTMLElement>("#evidence .ev-bpr td:last-child")].map((td) => td.getClientRects().length);
      return { hit, maxLines: Math.max(0, ...trip) };
    });
    expect(r.hit, `p ${p}: a card covers the heading`).toBe(false);
    expect(r.maxLines, `p ${p}: a holdout triplet wraps`).toBeLessThanOrEqual(1);
  }
});

for (const [w, h] of [[390, 844], [375, 812], [360, 800]] as const) test(`D-058/D-059: corner button clears the pill by 8px, the dagger is at least 11px (${w}x${h})`, async ({ page }) => {
  await open(page, w, h);
  await jump(page, "city", 0.78, 1200);
  const m = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>(".corner-btn")!.getBoundingClientRect();
    const p = document.querySelector<HTMLElement>(".nav-pill.is-fixed .menu-pill")!.getBoundingClientRect();
    const sup = document.querySelector<HTMLElement>(".city-cards sup");
    return { gap: c.left - p.right, dagger: sup ? parseFloat(getComputedStyle(sup).fontSize) : 99 };
  });
  expect(m.gap).toBeGreaterThanOrEqual(8);
  expect(m.dagger).toBeGreaterThanOrEqual(11);
});

/* ---------------- P01-FIX-005 (QA pass 5) ---------------- */

test("D-061: a meta.json failure is announced on a cold arrival at S02 card 4 (desktop)", async ({ page }) => {
  await page.route("**/data/meta.json", (r) => r.fulfill({ status: 500, body: "" }));
  await open(page, 1440, 900);
  await jump(page, "anatomy", 0.9, 1500);
  const a = page.locator("[role=alert]", { hasText: "META.JSON" });
  await expect(a).toHaveCount(1);
  await expect(a).toBeInViewport();
});
