import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type Atlas = { __atlas: { jumpTo: (id: string, p: number) => void; setObs: (p: object) => void; mapApi?: () => unknown } };
const jump = (page: Page, id: string, p: number) => page.evaluate(([id, p]) => (window as unknown as Atlas).__atlas.jumpTo(id as string, p as number), [id, p] as const);
async function open(page: Page, path = "") {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
}

test("S05: the lab output in the DOM equals the Python BPR vector (Manhattan, WED 23:00, demand x1.20)", async ({ page, request, isMobile }) => {
  test.skip(!!isMobile, "same model; D layout");
  const tv = await (await request.get("data/bpr_test_vectors.json")).json();
  const vec = tv.vectors.find((v: { case: string; inputs: { demand_mult: number; capacity_mult: number } }) => v.case === "Manhattan/borough/how71" && v.inputs.demand_mult === 1.2 && v.inputs.capacity_mult === 1);
  expect(vec).toBeTruthy();
  await open(page);
  await jump(page, "pressure", 0.5);
  const sim = page.locator(".lab-sim").first();
  await expect(sim).toBeVisible();
  await page.getByRole("radio", { name: "MN" }).click();
  await page.locator(".lab-range", { hasText: "HOUR" }).locator("input").focus();
  await page.keyboard.press("End"); // 23:00, weekday = WED
  const demand = page.locator(".lab-range", { hasText: "DEMAND" }).locator("input");
  await demand.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // 1.00 -> 1.20
  await expect(page.locator(".lab-range", { hasText: "DEMAND" })).toContainText("x1.20");
  await expect(page.locator(".lab-range", { hasText: "HOUR" })).toContainText("WED 23:00");
  // The function is exact (Vitest: 143 vectors at 1e-9). The page feeds it bpr_fit.json's baseline, which the
  // pipeline rounds (v to 0.01 trips, speed to 0.01 mph), so the DOM matches the vector to display precision.
  const got = Number(await sim.getAttribute("data-value"));
  expect(Math.abs(got - vec.expected.scenario_speed_mph) / vec.expected.scenario_speed_mph).toBeLessThan(1e-3);
  await expect(sim).toHaveText((Math.round(vec.expected.scenario_speed_mph * 10) / 10).toFixed(1));
  await expect(page.locator(".lab-stage .chip--simulated")).toBeVisible();
  await expect(page.locator(".lab-hatch")).toBeVisible();
  // aria-live sentence follows after the 400ms debounce
  await expect(page.getByTestId("lab-live")).toContainText("Simulated: median speed in Manhattan at WED 23:00");
  // RESET restores the observed city exactly
  await page.getByRole("button", { name: "RESET", exact: true }).click();
  await expect(page.locator(".lab-range", { hasText: "DEMAND" })).toContainText("x1.00");
  await expect(page.locator(".lab-range", { hasText: "ROAD CAPACITY" })).toContainText("+0%");
  await expect(sim).toHaveAttribute("data-value", (await sim.getAttribute("data-obs"))!);
});

test("S06: YOUR FUTURE is disabled until the lab changes, then enabled", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "D");
  await open(page);
  await jump(page, "futures", 0.5);
  const yours = page.locator(".fut-select").getByRole("radio", { name: /YOUR FUTURE/ });
  await expect(yours).toHaveAttribute("aria-disabled", "true");
  await jump(page, "pressure", 0.5);
  const demand = page.locator(".lab-range", { hasText: "DEMAND" }).locator("input");
  await demand.focus();
  await page.keyboard.press("ArrowRight");
  await jump(page, "futures", 0.5);
  await expect(yours).toHaveAttribute("aria-disabled", "false");
  await yours.click();
  await expect(yours).toHaveAttribute("aria-checked", "true");
});

test("nav jumps to each B2 section with aria-current, hash and focus", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop bar");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  for (const [label, id] of [["PRESSURE", "pressure"], ["FUTURES", "futures"], ["EVIDENCE", "evidence"], ["OBSERVATORY", "observatory"]]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "location");
    await expect(page.locator(`#${id}-title`)).toBeFocused();
  }
});

test("reverse and rapid scroll through S05-S08 never traps", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "wheel input");
  await open(page);
  await jump(page, "pressure", 0);
  await page.waitForTimeout(300);
  const bottom = () => page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
  let wheels = 0, lastY = -1;
  while (!(await bottom()) && wheels < 80) {
    await page.mouse.wheel(0, 1600); // rapid
    await page.waitForTimeout(120);
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThanOrEqual(lastY); // never pushed back
    lastY = y;
    wheels++;
  }
  expect(await bottom()).toBe(true);
  const top = await page.evaluate(() => document.getElementById("pressure")!.offsetTop);
  wheels = 0;
  while ((await page.evaluate(() => scrollY)) > top && wheels < 80) { await page.mouse.wheel(0, -1600); await page.waitForTimeout(120); wheels++; }
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(top);
});

test("OBS: search a zone -> inspector (sorted destinations) -> Esc closes and returns focus; EXPLORE locks scroll and Esc restores", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "D");
  await open(page);
  await jump(page, "observatory", 0);
  const box = page.getByRole("combobox", { name: "Search 263 zones" });
  await box.fill("jfk");
  await expect(page.getByRole("option", { name: /JFK AIRPORT/ })).toBeVisible(); // zone index loaded, list open
  await page.keyboard.press("Enter");
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading", { name: "JFK Airport" })).toBeVisible();
  const trips = await dlg.locator(".inspector__dest li .tnum").allTextContents();
  const nums = trips.map((t) => Number(t.split(" · ")[0]!.replace(/,/g, "")));
  expect(nums.length).toBeGreaterThan(0);
  expect([...nums].sort((a, b) => b - a)).toEqual(nums);
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(box).toBeFocused();
  await page.waitForFunction(() => !!(window as unknown as Atlas).__atlas.mapApi?.(), null, { timeout: 20000 });
  const y0 = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "EXPLORE" }).click();
  await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
  const yIn = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(yIn);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "EXPLORE" })).toBeVisible();
  expect(Math.abs((await page.evaluate(() => scrollY)) - yIn)).toBeLessThan(2);
  expect(y0).toBeGreaterThan(0);
});

test("OBS readout equals the sum of the region's zone values (QUEENS, WED 08:00, GREEN)", async ({ page, request, isMobile }) => {
  test.skip(!!isMobile, "D");
  const z = await (await request.get("data/zone_hour_week.json")).json();
  const zi = await (await request.get("data/zones_index.json")).json();
  const queens = new Set(zi.zones.filter((r: { borough: string }) => r.borough === "Queens").map((r: { LocationID: number }) => r.LocationID));
  let sum = 0;
  z.zones.forEach((loc: number, i: number) => { if (queens.has(loc)) sum += z.mean_trips.green[i * 168 + 56] ?? 0; });
  await open(page);
  await jump(page, "observatory", 0);
  await page.locator(".obs-rail").getByRole("radio", { name: "GREEN" }).click();
  await page.locator(".obs-region").getByRole("radio", { name: "QUEENS" }).click();
  await expect(page.locator(".obs-readout")).toContainText(`QUEENS → ${Math.round(sum).toLocaleString("en-US")} PICKUPS/HR`);
});

for (const [name, setup] of [
  ["pressure lab", async (p: Page) => { await jump(p, "pressure", 0.5); }],
  ["observatory with inspector", async (p: Page) => { await jump(p, "observatory", 0); await p.evaluate(() => (window as unknown as Atlas).__atlas.setObs({ selectedZone: 138 })); }],
  ["evidence stack", async (p: Page) => { await jump(p, "evidence", 0.96); }],
] as const) {
  test(`axe: no serious or critical violations (${name})`, async ({ page }) => {
    await open(page);
    await setup(page);
    await page.waitForTimeout(800);
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(", ")}`)).toEqual([]);
  });
}
