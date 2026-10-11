import { expect, test } from "@playwright/test";
import { NAV_IDS, collectErrors, expectConsistent, inView, jump, noOverflow, open, settle } from "./helpers";

test("3a. nav jump to each section lands there with hash, aria-current and focus", async ({ page, isMobile }) => {
  await open(page);
  for (const id of NAV_IDS) {
    if (isMobile) {
      await page.locator(".nav-pill.is-fixed .menu-pill").click();
      await page.locator("#menu-panel").getByRole("link", { name: new RegExp(`^${id.replace("-", " ")}$`, "i") }).click();
    } else {
      await page.getByRole("navigation", { name: "Chapters", exact: true }).locator(`a[href="#${id}"]`).click();
    }
    await settle(page, 500);
    expect(await inView(page), `${id} in view`).toBe(id);
    await expectConsistent(page, id);
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
  }
});

test("3b. Back / Forward restore the right section", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "history is viewport independent");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  const seq = ["anatomy", "corridors", "pressure", "evidence"];
  for (const id of seq) { await nav.locator(`a[href="#${id}"]`).click(); await settle(page, 400); }
  for (let i = seq.length - 2; i >= 0; i--) {
    await page.goBack();
    await settle(page, 600);
    await expect(page, `back to ${seq[i]}`).toHaveURL(new RegExp(`#${seq[i]}$`));
    expect(await inView(page)).toBe(seq[i]);
    await expectConsistent(page, `back ${seq[i]}`);
  }
  for (let i = 1; i < seq.length; i++) {
    await page.goForward();
    await settle(page, 600);
    expect(await inView(page), `forward to ${seq[i]}`).toBe(seq[i]);
  }
});

test("3c. deep link to every hash loads in that section", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "viewport independent");
  for (const id of ["rush-hour", "pressure", "closing"]) {
    await page.goto(`#${id}`);
    await page.keyboard.press("Escape");
    await settle(page, 900);
    expect(await inView(page), `deep link #${id}`).toBe(id === "closing" ? "observatory" : id);
  }
});

test("4. resize 1440x900 -> 390x844 -> 1440x900 keeps the section, no horizontal overflow", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sets its own viewports");
  const errors = collectErrors(page);
  await open(page);
  for (const id of ["anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page, 400);
    await jump(page, id, 0.5);
    await settle(page, 500);
    for (const [w, h] of [[390, 844], [1440, 900]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await settle(page, 800);
      expect(await inView(page), `${id} kept at ${w}`).toBe(id);
      expect(await noOverflow(page), `${id}: no horizontal overflow at ${w}`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
