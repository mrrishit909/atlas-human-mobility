/**
 * P01-FIX-001: one verification test per QA defect (docs/QA_REPORT.md). Viewports are set per test;
 * these run on the desktop project only (the mobile project would repeat them).
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

/** Tight text boxes (one per rendered line) for each selector's visible elements. */
function textBoxes(page: Page, selectors: string[]) {
  return page.evaluate((sels) => {
    const out: { name: string; left: number; top: number; right: number; bottom: number }[] = [];
    for (const sel of sels) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, k) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05 || el.closest("[aria-hidden=true]")) return;
        let o: HTMLElement | null = el; let op = 1;
        while (o) { op *= Number(getComputedStyle(o).opacity); o = o.parentElement; }
        if (op < 0.05) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
          out.push({ name: `${sel}#${k}`, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }
      });
    }
    return out;
  }, selectors);
}
/** Does the ring's stroke (circle of radius r, +-4px for nodes) pass through the box? */
function crossesRing(b: R, g: { cx: number; cy: number; r: number }) {
  const nx = Math.max(b.left, Math.min(g.cx, b.right)), ny = Math.max(b.top, Math.min(g.cy, b.bottom));
  const near = Math.hypot(nx - g.cx, ny - g.cy);
  const far = Math.max(...[[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => Math.hypot(x! - g.cx, y! - g.cy)));
  return near <= g.r + 4 && far >= g.r - 4;
}
function expectNoCollisions(boxes: R[], ring: { cx: number; cy: number; r: number } | null, ringFree: string[], label: string) {
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]!;
      if (a.name!.split("#")[0] === b.name!.split("#")[0] && a.name === b.name) continue; // lines of one block
      expect(overlap(a, b, 1), `${label}: ${a.name} overlaps ${b.name}`).toBe(false);
    }
    if (ring && ringFree.some((s) => a.name!.startsWith(s))) expect(crossesRing(a, ring), `${label}: ring crosses ${a.name}`).toBe(false);
  }
}
/**
 * Ring-vs-text is asserted at 1024x768, the composition D-001 reported. At 1440 and 1920 the
 * ambient S01 ring deliberately runs behind the display type at low alpha (approved in B1);
 * text-vs-text and text-vs-card are asserted at every viewport.
 */
const ringGeom = (page: Page, w: number, h: number) => (w === 1024 && h === 768 ? page.evaluate(() => window.__atlasRing?.geom ?? null) : Promise.resolve(null));

for (const [w, h] of ALL) test(`D-001: no text collides with text or cards, or the ring at 1024x768, in S01, S03a, S03b (${w}x${h})`, async ({ page }) => {
  test.setTimeout(120_000);
  {
    await open(page, w, h);
    await jump(page, "city", 0.78);
    const city = await textBoxes(page, [".city-statement h2", ".city-cards .note", ".city-foot"]);
    expectNoCollisions(city, await ringGeom(page, w, h), [".city-statement", ".city-cards"], `${w}x${h} S01`);
    await jump(page, "rush-hour", 0.35, 1200);
    const rush = await textBoxes(page, [".rush-text h2", ".rush-text .scene-body", ".rush-controls", ".rush-tags", ".rush-readout"]);
    expectNoCollisions(rush, await ringGeom(page, w, h), [".rush-text", ".rush-controls", ".rush-tags"], `${w}x${h} S03a`);
    for (const p of [0.1, 0.3, 0.55, 0.88]) {
      await jump(page, "corridors", p, 2400);
      const cor = await textBoxes(page, ["#corridors .cor-text h2", "#corridors .cor-body", "#corridors .cor-chips", "#corridors .cor-ledger", "#corridors .dial-title", "#corridors .ticket"]);
      expectNoCollisions(cor, await ringGeom(page, w, h), ["#corridors .cor-text", "#corridors .cor-body", "#corridors .cor-chips", "#corridors .cor-ledger", "#corridors .dial-title"], `${w}x${h} S03b p${p}`);
    }
  }
});

test("D-001: the S06 split ring never intersects a text block (all 7 viewports)", async ({ page }) => {
  test.setTimeout(180_000);
  for (const [w, h] of ALL) {
    await open(page, w, h);
    await jump(page, "futures", 0.5, 1500);
    const bb = JSON.parse((await page.locator(".fut-canvas").getAttribute("data-bbox"))!) as number[];
    const ring = { left: bb[0]!, top: bb[1]!, right: bb[2]!, bottom: bb[3]! };
    const blocks = await textBoxes(page, ["#futures .fut-text h2", "#futures .fut-callout", "#futures .fut-text .cor-chips", "#futures .fut-caption", "#futures .fut-deltas", "#futures .fut-select"]);
    for (const b of blocks) expect(overlap(ring, b), `${w}x${h}: ring vs ${b.name}`).toBe(false);
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
    const labels = await page.locator(".dem-label").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, text: e.textContent }; }));
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
