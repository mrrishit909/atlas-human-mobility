import { expect, test, type Page } from "@playwright/test";

type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void; morphParity?: () => Promise<{ zones: number; maxPx: number } | null>; mapApi?: () => unknown } };
const jump = (page: Page, id: string, p: number) => page.evaluate(([id, p]) => (window as unknown as Atlas).__atlas.jumpTo(id as string, p as number), [id, p] as const);
async function open(page: Page) {
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
}
const int = (n: number) => Math.round(n).toLocaleString("en-US");

test("rendered copy equals facts.json (S01 cards, S02 ledger title, S03b Manhattan)", async ({ page, request }) => {
  const facts = await (await request.get("data/facts.json")).json();
  await open(page);
  await jump(page, "city", 0.95);
  await expect(page.locator(".city-cards")).toContainText(`${int(facts.busiest_zone_how.mean_trips)} PICKUPS IN AN AVERAGE HOUR`);
  await expect(page.locator(".city-cards")).toContainText(`${int(facts.trips_per_minute_mean)} RIDES BEGAN, ON AVERAGE. ${int(facts.trips_kept_total)} IN ALL.`);
  await expect(page.locator(".scene-anatomy")).toContainText(`${int(facts.excluded_total)} rows didn't make it.`);
  await jump(page, "corridors", 0.1);
  await expect(page.locator(".cor-body")).toContainText(`${Math.round(facts.mn_internal_share_pct)}% OF RIDES THAT START IN MANHATTAN END THERE`);
});

test("S03b dial: p 0.6 is Brooklyn forward and backward; a rapid jump lands on the hinge", async ({ page, isMobile }) => {
  await open(page);
  const anchor = page.locator(".dial-title[data-anchor]");
  await jump(page, "corridors", 0.1);
  await expect(anchor).toHaveAttribute("data-anchor", "MN");
  await jump(page, "corridors", 0.6);
  await expect(anchor).toHaveAttribute("data-anchor", "BK");
  await jump(page, "corridors", 0.95);
  await expect(anchor).toHaveAttribute("data-anchor", "HINGE");
  await jump(page, "corridors", 0.6);
  await expect(anchor).toHaveAttribute("data-anchor", "BK");
  // visitor override: arrow keys re-anchor; the next threshold resumes the authored sequence
  await page.locator(".cor-hit").focus();
  await page.keyboard.press("ArrowRight");
  await expect(anchor).toHaveAttribute("data-anchor", "HINGE");
  await expect(page.getByRole("button", { name: "RESET DIAL" })).toBeVisible();
  await page.getByRole("button", { name: "RESET DIAL" }).click();
  await expect(anchor).toHaveAttribute("data-anchor", "BK");
  test.info().annotations.push({ type: "viewport", description: isMobile ? "M" : "D" });
});

test("S04 handoff: Canvas2D node positions match deck.gl's projection within 1px for 263/263 zones", async ({ page }) => {
  await open(page);
  await jump(page, "corridors", 0.5); // warms zones.geojson + the deck chunk, as in a real scroll
  await jump(page, "demand", 0.65);
  await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
  await jump(page, "demand", 0.65);
  await page.waitForFunction(() => (window as unknown as Atlas).__atlas.morphParity!().then((x) => !!x), null, { timeout: 20000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => (window as unknown as Atlas).__atlas.morphParity!());
  expect(r).not.toBeNull();
  expect(r!.zones).toBe(263);
  expect(r!.maxPx).toBeLessThan(1);
});

test("S03a states: a failed zone_hour_week fetch shows the error, RETRY re-fetches and recovers", async ({ page }) => {
  let calls = 0;
  await page.route("**/data/zone_hour_week.json", (route) => (++calls === 1 ? route.fulfill({ status: 503, body: "" }) : route.continue()));
  await open(page);
  await jump(page, "rush-hour", 0.4);
  const err = page.locator(".rush-text [role=alert]");
  await expect(err).toContainText("COULD NOT LOAD ZONE_HOUR_WEEK.JSON (HTTP 503)");
  await err.getByRole("button", { name: "RETRY" }).click();
  await expect(page.locator(".rush-readout__total")).toContainText("PICKUPS / HOUR");
  expect(calls).toBe(2);
});

test("S03a controls: GREEN changes the readout; 263 zones stay in the a11y table", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "same component on M");
  await open(page);
  await jump(page, "rush-hour", 0.4);
  const total = page.locator(".rush-readout__total");
  await expect(total).toContainText("PICKUPS / HOUR");
  const before = await total.textContent();
  await page.locator(".rush-controls").getByRole("radio", { name: "GREEN" }).click();
  await expect(total).not.toHaveText(before!);
  await expect(page.locator(".scene-rush table tbody tr")).toHaveCount(24);
});

test("deep link to #demand loads zone shapes and lands on the map without visiting S03", async ({ page }) => {
  await page.goto("#demand");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
  await expect(page.locator("#demand-title")).toBeFocused();
  await expect(page.locator(".dem-text")).toContainText("HEIGHT = 2024 PICKUPS");
});

const FAILURES: { file: string; scene: string; p: number; region: string; recovered: string; disabled?: string }[] = [
  { file: "bpr_fit.json", scene: "pressure", p: 0.5, region: ".scene-pressure", recovered: "MEDIAN SPEED", disabled: ".lab-range input" },
  { file: "daily.json", scene: "evidence", p: 0.5, region: ".ev-stack", recovered: "RAW TOTALS" },
  { file: "weather_model.json", scene: "evidence", p: 0.5, region: ".scene-evidence", recovered: "ASSOCIATION, NOT CAUSE" },
  { file: "facts.json", scene: "anatomy", p: 0.14, region: ".scene-anatomy", recovered: "A journey, as the city records it." },
  { file: "reconciliation.json", scene: "anatomy", p: 0.6, region: ".scene-anatomy", recovered: "RAW = KEPT + EXCLUDED" },
  { file: "od_top.json", scene: "corridors", p: 0.1, region: ".cor-text", recovered: "OF RIDES THAT START IN MANHATTAN" },
  { file: "zones.geojson", scene: "demand", p: 0.9, region: ".dem-text", recovered: "HEIGHT = 2024 PICKUPS" },
];
for (const f of FAILURES) {
  test(`state: ${f.file} fails -> error line -> RETRY re-fetches exactly once and recovers`, async ({ page, isMobile }) => {
    test.skip(!!isMobile, "state logic is viewport-independent");
    let calls = 0;
    await page.route(`**/data/${f.file}`, (route) => (++calls === 1 ? route.fulfill({ status: 500, body: "" }) : route.continue()));
    await open(page);
    await jump(page, f.scene, f.p);
    const alert = page.locator(`${f.region} [role=alert]`).filter({ hasText: `COULD NOT LOAD ${f.file.toUpperCase()} (HTTP 500)` }).first();
    await expect(alert).toBeVisible({ timeout: 15000 });
    expect(calls).toBe(1); // no silent retry
    if (f.disabled) await expect(page.locator(f.disabled).first()).toBeDisabled();
    await alert.getByRole("button", { name: "RETRY" }).click();
    await expect(page.locator(f.region).first()).toContainText(f.recovered, { timeout: 15000 });
    expect(calls).toBe(2);
  });
}
