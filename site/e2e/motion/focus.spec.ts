import { expect, test, type Page } from "@playwright/test";
import { jump, open, settle } from "./helpers";

const visibleIndicator = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return { ok: el.matches(":focus-visible") && (outline || cs.boxShadow !== "none"), fv: el.matches(":focus-visible"), outline: `${cs.outlineStyle} ${cs.outlineWidth}`, shadow: cs.boxShadow };
  });

test("8a. desktop: every nav item and utility shows a focus ring", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "bar is desktop");
  await open(page);
  await page.keyboard.press("Tab"); // enter keyboard modality
  const bad: string[] = [];
  for (const sel of [".nav-bar.is-fixed .nav__item", ".nav-bar.is-fixed .nav__util", ".corner-btn"]) {
    const n = await page.locator(sel).count();
    for (let i = 0; i < n; i++) {
      const loc = page.locator(sel).nth(i);
      if (!(await loc.isVisible())) continue; // .corner-btn--compact is display:none at >=1024
      await loc.focus();
      const r = await loc.evaluate((el) => { const cs = getComputedStyle(el); return { t: (el.textContent ?? "").trim(), fv: el.matches(":focus-visible"), o: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0, s: cs.boxShadow !== "none" }; });
      if (!(r.fv && (r.o || r.s))) bad.push(`${sel} "${r.t}" fv=${r.fv} outline=${r.o} shadow=${r.s}`);
    }
  }
  expect(bad).toEqual([]);
});

test("8b. scene controls (S03a radios, S03b dial, S04 HEIGHT, story tabs) show a focus ring", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop");
  await open(page);
  const bad: string[] = [];
  const check = async (id: string, p: number, sel: string, label: string) => {
    await jump(page, id, p);
    await settle(page, 900);
    await page.keyboard.press("Tab");
    const loc = page.locator(sel).first();
    if (!(await loc.count())) { bad.push(`${label}: not found (${sel})`); return; }
    await loc.focus();
    const r = await visibleIndicator(page, sel);
    if (!r.ok) bad.push(`${label}: ${JSON.stringify(r)}`);
  };
  await check("rush-hour", 0.4, '#rush-hour [role="radio"][aria-checked="true"]', "S03a active radio");
  await check("rush-hour", 0.4, '#rush-hour [role="radio"][aria-checked="false"]', "S03a inactive radio");
  await check("corridors", 0.5, "#corridors .cor-hit", "S03b dial");
  await check("demand", 0.6, '#demand [role="radio"]', "S04 HEIGHT radio");
  await check("anatomy", 0.35, '#anatomy [role="tab"][aria-selected="true"]', "S02 story tab");
  await check("pressure", 0.5, "#pressure .lab-range input", "S05 range");
  expect(bad).toEqual([]);
});

test("8c. mobile: MENU pill and its items show a focus ring", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "pill is T/M");
  await open(page);
  await page.keyboard.press("Tab");
  const pill = page.locator(".nav-pill.is-fixed .menu-pill");
  await pill.focus();
  expect((await visibleIndicator(page, ".nav-pill.is-fixed .menu-pill")).ok).toBe(true);
  await pill.click();
  const bad: string[] = [];
  await page.keyboard.press("Tab");
  const n = await page.locator("#menu-panel .nav__item").count();
  for (let i = 0; i < n; i++) {
    const loc = page.locator("#menu-panel .nav__item").nth(i);
    await loc.focus();
    const r = await loc.evaluate((el) => { const cs = getComputedStyle(el); return el.matches(":focus-visible") && ((cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none"); });
    if (!r) bad.push((await loc.textContent()) ?? String(i));
  }
  expect(bad).toEqual([]);
});
