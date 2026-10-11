/**
 * QA L12 / D-055: a control is only "working" if a real pointer reaches it. For every RETRY in every
 * route-blocked error state, and for every other visible control at each scene's landing, the element at the
 * control's centre must be the control, and a real mouse click / touch tap at those coordinates must act.
 * Never locator.click(): it waits for overlays to move and so hides exactly this defect.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void; setObs: (p: object) => void } };
const VPS = [[1440, 900], [768, 1024], [390, 844]] as const;

test.beforeEach(({ isMobile }) => test.skip(!!isMobile, "viewports are set inside each test"));

async function context(browser: Browser, baseURL: string, w: number, h: number) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: w, height: h }, hasTouch: w < 768 });
  return { ctx, page: await ctx.newPage() };
}
async function land(page: Page, scene: string, p: number) {
  await page.goto("", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(([s, p]) => (window as unknown as Atlas).__atlas.jumpTo(s as string, p as number), [scene, p] as const);
  await page.waitForTimeout(1500);
}
/** Centre of el, and whether the topmost element there is el (or inside it). */
const reach = (page: Page, sel: string, i: number) => page.evaluate(([sel, i]) => {
  const el = document.querySelectorAll<HTMLElement>(sel as string)[i as number]!;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return { x, y, ok: !!top && (top === el || el.contains(top)), top: top ? `${top.tagName}.${String((top as HTMLElement).className).slice(0, 40)}` : "none", label: (el.textContent ?? "").trim().slice(0, 30) };
}, [sel, i] as const);
const tap = (page: Page, w: number, x: number, y: number) => (w < 768 ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

// [file, scene, p, OBS layer to select]
const CASES: [string, string, number, string?][] = [
  ["facts.json", "city", 0.78], ["facts.json", "anatomy", 0.35], ["facts.json", "rush-hour", 0.35], ["facts.json", "corridors", 0.3],
  ["facts.json", "demand", 0.89], ["facts.json", "pressure", 0.5], ["facts.json", "evidence", 0.5], ["facts.json", "closing", 0.9],
  ["zones_index.json", "city", 0.78], ["reconciliation.json", "city", 0.78], ["reconciliation.json", "anatomy", 0.5],
  ["od_ring_top.json", "city", 0.78], ["od_ring_top.json", "rush-hour", 0.35], ["od_ring_top.json", "corridors", 0.3],
  ["meta.json", "anatomy", 0.5], ["meta.json", "evidence", 0.5], ["meta.json", "closing", 0.9],
  ["zone_hour_week.json", "rush-hour", 0.35], ["zone_hour_week.json", "observatory", 0],
  ["od_top.json", "rush-hour", 0.35], ["od_top.json", "corridors", 0.3], ["od_top.json", "observatory", 0],
  ["zone_month.json", "demand", 0.89], ["zones.geojson", "demand", 0.89], ["zones.geojson", "observatory", 0],
  ["bpr_fit.json", "pressure", 0.5], ["bpr_fit.json", "futures", 0.5], ["bpr_fit.json", "evidence", 0.5],
  ["daily.json", "evidence", 0.5], ["weather_model.json", "evidence", 0.5], ["clusters.json", "evidence", 0.5],
  ["clusters.json", "demand", 0.99], ["network.json", "demand", 0.99], ["clusters.json", "observatory", 0, "CLUSTERS"], ["network.json", "observatory", 0, "NETWORK"],
];

for (const [w, h] of VPS) for (const [file, scene, p, layer] of CASES) {
  test(`L12 RETRY: ${file} in ${scene} at ${w}x${h} is reachable and recovers with a real ${w < 768 ? "tap" : "click"}`, async ({ browser }, info) => {
    const { ctx, page } = await context(browser, info.project.use.baseURL!, w, h);
    let block = true, hits = 0;
    await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.fulfill({ status: 500, body: "" }) : r.continue(); });
    await land(page, scene, p);
    if (layer) {
      const radio = page.locator("#observatory").getByRole("radio", { name: layer, exact: true }).first();
      if (!(await radio.isVisible())) await page.locator("#observatory").getByRole("button", { name: /LAYERS/ }).first().click();
      await radio.click();
      if (await page.locator("#observatory").getByRole("button", { name: /CLOSE/ }).first().isVisible()) await page.locator("#observatory").getByRole("button", { name: /CLOSE/ }).first().click();
      await page.waitForTimeout(600);
    }
    const sel = `#${scene} .state-error`;
    const lines = page.locator(sel, { hasText: `COULD NOT LOAD ${file.toUpperCase()}` });
    await expect(lines.first(), "the failure is shown in the scene").toBeVisible({ timeout: 10000 });
    // the line the visitor sees: in the viewport and painted
    const idx = await page.evaluate(([sel, f]) => [...document.querySelectorAll<HTMLElement>(sel as string)].findIndex((e) => {
      const r = e.getBoundingClientRect();
      return (e.textContent ?? "").includes(f as string) && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !e.closest("[aria-hidden=true]");
    }), [sel, `COULD NOT LOAD ${file.toUpperCase()}`] as const);
    expect(idx, "an error line fully in the viewport").toBeGreaterThanOrEqual(0);
    const r = await reach(page, `${sel} .btn-square`, idx);
    expect(r.ok, `RETRY centre (${Math.round(r.x)},${Math.round(r.y)}) hits ${r.top}`).toBe(true);
    block = false;
    const before = hits;
    await tap(page, w, r.x, r.y);
    await expect(page.locator(`#${scene} .state-error`, { hasText: file.toUpperCase() })).toHaveCount(0, { timeout: 10000 });
    expect(hits, "exactly one re-fetch").toBe(before + 1);
    await ctx.close();
  });
}

const LANDINGS: [string, number][] = [["city", 0.78], ["anatomy", 0.14], ["rush-hour", 0.35], ["corridors", 0.3], ["corridors", 0.88], ["demand", 0.89],
  ["pressure", 0.5], ["futures", 0.5], ["evidence", 0.5], ["observatory", 0], ["closing", 0.9]];

for (const [w, h] of VPS) test(`L12 every control: the topmost element at each visible control's centre is that control (${w}x${h})`, async ({ browser }, info) => {
  test.setTimeout(180_000);
  const { ctx, page } = await context(browser, info.project.use.baseURL!, w, h);
  const bad: string[] = [];
  let checked = 0;
  for (const [scene, p] of LANDINGS) {
    await land(page, scene, p);
    const found = await page.evaluate(() => {
      const out: string[] = [];
      let n = 0;
      const els = document.querySelectorAll<HTMLElement>("button, a[href], [role=radio], [role=tab], input, [role=combobox]");
      for (const el of els) {
        if (el.closest("[aria-hidden=true], [inert]") || (el as HTMLButtonElement).disabled) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; // scrolled away, not on screen
        let o: HTMLElement | null = el, op = 1;
        while (o) { const cs = getComputedStyle(o); if (cs.visibility === "hidden" || cs.display === "none") { op = 0; break; } op *= Number(cs.opacity); o = o.parentElement; }
        if (op < 0.5) continue; // not shown (fading, or a skip link off-screen)
        n++;
        const top = document.elementFromPoint(x, y);
        if (!top || !(top === el || el.contains(top))) out.push(`"${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 28)}" at ${Math.round(x)},${Math.round(y)} under ${top ? `${top.tagName}.${String((top as HTMLElement).className).slice(0, 30)}` : "none"}`);
      }
      return { out, n };
    });
    checked += found.n;
    bad.push(...found.out.map((f) => `${scene}@${p}: ${f}`));
  }
  await ctx.close();
  expect(checked, "controls checked across the landings").toBeGreaterThan(w < 768 ? 30 : 60);
  expect(bad).toEqual([]);
});

test("L12 a real click acts: S06 futures and S03a service radios respond to page.mouse at their centres", async ({ browser }, info) => {
  for (const [w, h] of VPS) {
    const { ctx, page } = await context(browser, info.project.use.baseURL!, w, h);
    await land(page, "futures", 0.5);
    let r = await page.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>("#futures [role=radio]")].find((e) => e.textContent?.includes("A LANE LOST"))!; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await tap(page, w, r.x, r.y);
    await expect(page.locator("#futures [role=radio]", { hasText: "A LANE LOST" })).toHaveAttribute("aria-checked", "true");
    await land(page, "rush-hour", 0.35);
    r = await page.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>("#rush-hour [role=radio]")].find((e) => e.textContent?.trim() === "GREEN")!; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await tap(page, w, r.x, r.y);
    await expect(page.locator("#rush-hour [role=radio]", { hasText: /^GREEN$/ })).toHaveAttribute("aria-checked", "true");
    await ctx.close();
  }
});
