import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isLocal = (url: string) => /^(http:\/\/(localhost|127\.0\.0\.1):\d+\/|data:|blob:)/.test(url);

async function open(page: Page, path = "") {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape"); // completes the intro (MOTION_SYSTEM 5.1)
}

test("no external network requests, including the lazy deck.gl chunk (luma.gl / loaders.gl)", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { if (!isLocal(r.url())) external.push(r.url()); });
  await page.goto("", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  for (const [id, p] of [["rush-hour", 0.4], ["corridors", 0.5], ["demand", 0.9]] as const) {
    await page.evaluate(([id, p]) => (window as unknown as { __atlas: { jumpTo: (i: string, p: number) => void } }).__atlas.jumpTo(id, p), [id, p] as const);
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => !!(window as unknown as { __atlas: { mapApi?: () => unknown } }).__atlas.mapApi?.(), null, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});

test("desktop nav: keyboard jump, aria-current, focus, back/forward", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop bar only");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  await expect(nav).toBeVisible();
  const city = nav.getByRole("link", { name: "CITY" });
  await expect(city).toHaveAttribute("aria-current", "location");

  // Tab moves through the items in order
  await city.focus();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "ANATOMY" })).toBeFocused();

  const corridors = nav.getByRole("link", { name: "CORRIDORS" });
  await corridors.focus();
  await page.keyboard.press("Enter");
  await expect(corridors).toHaveAttribute("aria-current", "location");
  await expect(city).not.toHaveAttribute("aria-current", /.*/);
  await expect(page).toHaveURL(/#corridors$/);
  await expect(page.locator("#corridors-title")).toBeFocused();
  // landed at the scene's entry-resolved progress (6.2: S03b 0.05), within 0.01
  const p = await page.evaluate(() => (window as unknown as { __atlas: { getProgress: (id: string) => number } }).__atlas.getProgress("corridors"));
  expect(Math.abs(p - 0.05)).toBeLessThan(0.01);

  await nav.getByRole("link", { name: "PRESSURE" }).click();
  await expect(page).toHaveURL(/#pressure$/);
  await page.goBack();
  await expect(page).toHaveURL(/#corridors$/);
  await expect(corridors).toHaveAttribute("aria-current", "location");
});

test("mobile menu pill: open, Esc closes and returns focus, item jumps", async ({ page, isMobile }) => {
  test.skip(!isMobile, "T/M pill only");
  await open(page);
  const pill = page.locator(".nav-pill.is-fixed .menu-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("CITY");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#menu-panel")).toBeHidden();

  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#menu-panel");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  await expect(panel).toBeHidden();

  await pill.click();
  await panel.getByRole("link", { name: "DEMAND" }).click();
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#demand$/);
  await expect(pill).toContainText("DEMAND");
});

test("reduced motion: no pinned stages, no blur, page bottom reachable", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const sticky = await page.evaluate(() => [...document.querySelectorAll(".stage")].filter((s) => getComputedStyle(s).position === "sticky").length);
  expect(sticky).toBe(0);
  const blurred = await page.evaluate(() => [...document.querySelectorAll(".wr-word")].filter((w) => getComputedStyle(w).filter !== "none").length);
  expect(blurred).toBe(0);
  await expect(page.locator(".nav-bar.is-fixed")).toBeVisible(); // intro end state at first frame
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  let wheels = 0;
  while (wheels < 400) {
    await page.mouse.wheel(0, 1000);
    wheels++;
    const atBottom = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    if (atBottom) break;
  }
  // no traps: at most ~1 wheel per 1000px (+ slack), well under the 10 per 1000px budget
  const finalHeight = await page.evaluate(() => document.documentElement.scrollHeight); // data-bound content grows the page
  expect(wheels).toBeLessThanOrEqual(Math.ceil(Math.max(height, finalHeight) / 1000) + 2);
  await ctx.close();
});

test("motion toggle switches the whole site to reduced motion and back", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "toggle lives in the bar on D");
  await open(page);
  const toggle = page.getByRole("button", { name: "MOTION ON" });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "MOTION OFF" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
});

test("resize D -> M keeps the scene and its progress, without errors", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "starts at 1440");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await open(page);
  type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void; getProgress: (id: string) => number } };
  await page.evaluate(() => (window as unknown as Atlas).__atlas.jumpTo("anatomy", 0.5));
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const p = await page.evaluate(() => (window as unknown as Atlas).__atlas.getProgress("anatomy"));
  expect(Math.abs(p - 0.5)).toBeLessThan(0.01);
  await expect(page.locator(".nav-pill.is-fixed .menu-pill")).toContainText("ANATOMY");
  expect(errors).toEqual([]);
});

for (const path of [""]) {
  test(`axe: no serious or critical violations (${path || "app shell"})`, async ({ page }) => {
    await open(page, path);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
