import { expect, test } from "@playwright/test";
import { open } from "./helpers";

// Playwright requires an object-destructuring first argument even when no fixture is used.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "intro chrome checked at 1440x900"));
const navVisible = (page: import("@playwright/test").Page) => page.locator(".nav-bar.is-fixed:not(.is-hidden)");

test("7a. SKIP INTRO compresses the intro", async ({ page }) => {
  await page.goto("");
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toBeVisible();
  await expect(page.locator(".nav-bar.is-fixed.is-hidden")).toHaveCount(1); // still playing
  const t0 = Date.now();
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  await expect(navVisible(page)).toBeVisible({ timeout: 3000 });
  expect(Date.now() - t0, "skip must beat the 4.2s natural nav entry").toBeLessThan(2500);
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toHaveCount(0);
});

test("7b. Esc compresses the intro", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("");
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toBeVisible();
  const t0 = Date.now();
  await page.keyboard.press("Escape");
  await expect(navVisible(page)).toBeVisible({ timeout: 3000 });
  expect(Date.now() - t0).toBeLessThan(2500);
  await ctx.close();
});

test("7c. a second load in the same session does not replay the intro", async ({ page }) => {
  await page.goto("");
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toBeVisible(); // listeners are attached once the button exists
  await page.keyboard.press("Escape");
  await expect(navVisible(page)).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toHaveCount(0);
  await expect(navVisible(page)).toBeVisible({ timeout: 1000 }); // immediately, not at 4.2s
  await page.goto("#corridors");
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toHaveCount(0);
});

test("7d. REPLAY INTRO replays from the top and can be skipped again", async ({ page }) => {
  await open(page);
  await page.evaluate(() => scrollTo(0, 3000));
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "REPLAY INTRO" }).first().click();
  await expect(page.getByRole("button", { name: "SKIP INTRO" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
  await expect(page.locator(".nav-bar.is-fixed.is-hidden")).toHaveCount(1);
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  await expect(navVisible(page)).toBeVisible({ timeout: 3000 });
});
