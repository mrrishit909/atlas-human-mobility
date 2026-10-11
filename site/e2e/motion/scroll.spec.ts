import { expect, test } from "@playwright/test";
import { IDS, NAV_IDS, collectErrors, expectConsistent, finiteState, inView, jump, navActive, open, settle, trackBox } from "./helpers";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "wheel/scroll compositions run at 1440x900"));

test("1. every pinned track releases its stage at the end (no scroll trap)", async ({ page }) => {
  await open(page);
  for (const id of IDS) {
    await jump(page, id, 1); // native scrollTo right after a wheel is reverted by Lenis (QA-003), so use the engine jump
    await settle(page, 500);
    const y0 = await page.evaluate(() => scrollY);
    const atBottom = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    if (atBottom) continue; // last track: the page end is the release
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 700);
    await settle(page, 900);
    const y1 = await page.evaluate(() => scrollY);
    expect(y1, `${id}: wheel at track end must move the page`).toBeGreaterThan(y0 + 300);
    const stageTop = await page.evaluate((id) => document.querySelector(`#${id} .stage`)!.getBoundingClientRect().top, id);
    if (id !== "observatory") expect(stageTop, `${id}: stage released (scrolls off)`).toBeLessThan(-100);
  }
});

test("2a. reverse scroll: wheel up from the bottom walks back through every section", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  const seen: string[] = [];
  let stuck = 0, last = Infinity;
  for (let i = 0; i < 160 && stuck < 3; i++) {
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(110);
    const y = await page.evaluate(() => scrollY);
    stuck = y >= last ? stuck + 1 : 0; // never pushed forward; must keep decreasing until 0
    last = y;
    const s = await inView(page);
    if (s && seen[seen.length - 1] !== s) seen.push(s);
    if (y <= 0) break;
  }
  expect(last).toBeLessThanOrEqual(1);
  expect(seen[seen.length - 1]).toBe("city");
  for (const id of NAV_IDS) expect(seen, `visited ${id} on the way up`).toContain(id);
  await settle(page);
  await expectConsistent(page, "after reverse walk");
  expect(await finiteState(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("2b. rapid wheel bursts and scrollTo jumps across tracks land consistently", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const order = ["demand", "city", "closing", "corridors", "evidence", "rush-hour", "observatory", "anatomy", "pressure", "futures", "city"];
  for (const id of order) {
    const b = await trackBox(page, id);
    await page.evaluate((y) => scrollTo(0, y), Math.round(b.top + 0.3 * (b.height - b.vh)));
    for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, k % 2 ? -900 : 1400); await page.waitForTimeout(25); } // burst, no settle
  }
  await settle(page, 1200);
  await expectConsistent(page, "after jump+burst storm");
  expect(await finiteState(page)).toBe(true);
  // the ring/map director must still answer a normal jump after the storm
  await jump(page, "corridors");
  await settle(page);
  expect(await inView(page)).toBe("corridors");
  expect(errors).toEqual([]);
});

test("2c. slow forward scroll keeps nav active equal to the section in view at every step", async ({ page }) => {
  await open(page);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const bad: string[] = [];
  for (let y = 0; y < total; y += 900) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(160);
    const [v, n] = [await inView(page), await navActive(page)];
    if (v !== n) bad.push(`y=${y} view=${v} nav=${n}`);
  }
  expect(bad).toEqual([]);
});
