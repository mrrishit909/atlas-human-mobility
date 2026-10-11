import { expect, test } from "@playwright/test";
import { IDS, NAV_IDS, inView, jump, open, settle } from "./helpers";

test("5. reduced motion: all sections reachable by nav and keyboard, no pin, no canvas-only content", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  expect(await page.evaluate(() => [...document.querySelectorAll(".stage")].filter((s) => getComputedStyle(s).position === "sticky").length)).toBe(0);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  for (const id of NAV_IDS) {
    await nav.locator(`a[href="#${id}"]`).click();
    await settle(page, 400);
    expect(await inView(page), `click ${id}`).toBe(id);
  }
  // keyboard only: focus a nav link and press Enter
  await page.evaluate(() => scrollTo(0, 0));
  for (const id of ["corridors", "futures"]) {
    await nav.locator(`a[href="#${id}"]`).focus();
    await page.keyboard.press("Enter");
    await settle(page, 400);
    expect(await inView(page), `Enter ${id}`).toBe(id);
  }
  // every section has real text, every canvas is hidden from AT or labelled
  const report = await page.evaluate((ids) => ({
    thin: ids.filter((i) => (document.getElementById(i)?.innerText ?? "").replace(/\s+/g, " ").trim().length < 80),
    noHeading: ids.filter((i) => !(document.getElementById(i)?.querySelector("h1,h2,h3")?.textContent ?? "").trim()),
    canvases: [...document.querySelectorAll("canvas")].filter((c) => c.getAttribute("aria-hidden") !== "true" && !c.getAttribute("aria-label") && c.getAttribute("role") !== "img" && !c.closest("[aria-hidden='true'],[role='img']")).map((c) => c.className || c.id || "canvas"),
  }), [...IDS]);
  expect(report.thin, "sections with under 80 chars of text").toEqual([]);
  expect(report.noHeading, "sections without a heading").toEqual([]);
  expect(report.canvases, "unlabelled, non-hidden canvases").toEqual([]);
  // page bottom reachable from the keyboard
  await page.keyboard.press("End");
  await expect.poll(() => page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2)).toBe(true);
  await ctx.close();
});

for (const [w, h] of [[360, 800], [375, 812], [390, 844]] as const) {
  test(`6. story cards do not clip and clear the MENU pill at ${w}x${h}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sets its own viewport");
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const problems: string[] = [];
    for (const [id, ps] of [["city", [0.7, 0.85, 0.95]], ["anatomy", [0.17, 0.36, 0.55, 0.74]]] as const) {
      for (const p of ps) {
        await jump(page, id, p);
        await settle(page, 1100); // sampled on each card's plateau (deckK: 0.12 + 0.19 i + 0.05), not mid-slide
        const r = await page.evaluate(() => {
          const pill = document.querySelector(".nav-pill.is-fixed .menu-pill")?.getBoundingClientRect();
          const cards = [...document.querySelectorAll<HTMLElement>(".story-card, .note")].map((el) => ({ el, r: el.getBoundingClientRect(), o: Number(getComputedStyle(el).opacity) }))
            .filter((c) => c.o > 0.5 && c.r.width > 0 && c.r.bottom > 0 && c.r.top < innerHeight && c.r.right > 0 && c.r.left < innerWidth);
          // the active card is the one most centred horizontally
          cards.sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - innerWidth / 2) - Math.abs(b.r.left + b.r.width / 2 - innerWidth / 2));
          const c = cards[0];
          return { vw: innerWidth, pill: pill && { l: pill.left, r: pill.right, t: pill.top, b: pill.bottom }, card: c && { l: c.r.left, r: c.r.right, t: c.r.top, b: c.r.bottom, cls: c.el.className } };
        });
        if (!r.card) { problems.push(`${id}@${p}: no card in view`); continue; }
        if (r.card.l < -0.5 || r.card.r > r.vw + 0.5) problems.push(`${id}@${p}: card clips x ${r.card.l.toFixed(0)}..${r.card.r.toFixed(0)} of ${r.vw}`);
        const pill = r.pill;
        if (pill && r.card.l < pill.r && r.card.r > pill.l && r.card.t < pill.b && r.card.b > pill.t) problems.push(`${id}@${p}: card y ${r.card.t.toFixed(0)}..${r.card.b.toFixed(0)} overlaps MENU pill y ${pill.t.toFixed(0)}..${pill.b.toFixed(0)}`);
      }
    }
    await page.screenshot({ path: `test-results/qa-cards-${w}x${h}.png` });
    expect(problems).toEqual([]);
  });
}
