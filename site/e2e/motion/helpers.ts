import { expect, type Page } from "@playwright/test";

export const IDS = ["city", "anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence", "observatory", "closing"] as const;
export const NAV_IDS = IDS.filter((i) => i !== "closing");
type Atlas = { __atlas: { jumpTo: (id: string, p?: number) => void; getProgress: (id: string) => number } };

export async function open(page: Page, path = "") {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape"); // completes the intro
  await page.waitForFunction(() => !document.querySelector(".nav-bar.is-hidden, .nav-pill.is-hidden") || document.querySelector(".nav-bar.is-fixed:not(.is-hidden), .nav-pill.is-fixed:not(.is-hidden)"), null, { timeout: 8000 });
}

export const jump = (page: Page, id: string, p?: number) =>
  page.evaluate(([id, p]) => (window as unknown as Atlas).__atlas.jumpTo(id as string, p as number | undefined), [id, p] as const);

/** Section whose box contains the viewport centre (same rule as the engine; closing reports as observatory like the nav). */
export const inView = (page: Page) =>
  page.evaluate(() => {
    const c = innerHeight / 2;
    for (const s of document.querySelectorAll<HTMLElement>("section.track")) {
      const r = s.getBoundingClientRect();
      if (r.top <= c && c < r.bottom) return s.id === "closing" ? "observatory" : s.id;
    }
    return null;
  });

/** Nav's active item id (bar and pill share one aria-current source). */
export const navActive = (page: Page) =>
  page.evaluate(() => document.querySelector(".nav__item[aria-current]")?.getAttribute("href")?.slice(1) ?? null);

export const settle = async (page: Page, ms = 700) => { await page.waitForTimeout(ms); };

export async function expectConsistent(page: Page, label: string) {
  await expect.poll(async () => `${await inView(page)}|${await navActive(page)}`, { message: label, timeout: 4000 })
    .toMatch(/^([a-z-]+)\|\1$/);
}

export const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
export const finiteState = (page: Page) =>
  page.evaluate((ids) => {
    const a = (window as unknown as Atlas).__atlas;
    const ring = (window as unknown as { __atlasRing?: { p: number } }).__atlasRing;
    return ids.every((i) => Number.isFinite(a.getProgress(i))) && (!ring || Number.isFinite(ring.p));
  }, [...IDS]);

export const trackBox = (page: Page, id: string) =>
  page.evaluate((id) => {
    const s = document.getElementById(id)!;
    const r = s.getBoundingClientRect();
    return { top: r.top + scrollY, height: r.height, vh: innerHeight };
  }, id);

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}
