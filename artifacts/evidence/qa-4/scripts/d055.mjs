// P01-QA-005: does a real pointer click/tap on RETRY reach the button? (S05/S07 stage overlays) + clusters at the S04 cluster phase
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-4/probe";
const BASE = "http://localhost:4301/atlas-human-mobility/";
const b = await chromium.launch();
const cases = [["facts.json", "evidence", 0.35, 390], ["meta.json", "evidence", 0.15, 390], ["daily.json", "evidence", 0.55, 1440], ["daily.json", "evidence", 0.55, 390], ["weather_model.json", "evidence", 0.55, 1440], ["facts.json", "evidence", 0.35, 1440], ["bpr_fit.json", "pressure", 0.5, 390], ["facts.json", "pressure", 0.5, 390], ["reconciliation.json", "anatomy", 0.65, 390], ["facts.json", "evidence", 0.35, 768], ["bpr_fit.json", "evidence", 0.55, 1024]];
for (const [file, id, p, w] of cases) {
  const c = await b.newContext({ viewport: { width: w, height: w < 768 ? 844 : w === 768 ? 1024 : w === 1024 ? 768 : 900 }, hasTouch: w < 1024, isMobile: w < 768 });
  const pg = await c.newPage();
  let block = true, hits = 0;
  await pg.route(`**/data/${file}`, (r) => { hits++; return block ? r.abort("failed") : r.continue(); });
  await pg.goto(BASE, { waitUntil: "networkidle" }); await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
  await pg.evaluate(([i, q]) => window.__atlas.jumpTo(i, q), [id, p]); await pg.waitForTimeout(3500);
  const btn = pg.locator(`#${id} .state-error`, { hasText: file.toUpperCase() }).getByRole("button", { name: /RETRY/ }).first();
  const box = await btn.boundingBox();
  if (!box) { console.log(file, id, w, "no RETRY"); await c.close(); continue; }
  const top = await pg.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? `${h.tagName}.${String(h.className).slice(0, 40)}` : "null"; }, [box.x + box.width / 2, box.y + box.height / 2]);
  block = false; const h0 = hits;
  if (w < 1024) await pg.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await pg.waitForTimeout(3000);
  const left = await pg.locator(`#${id} .state-error`, { hasText: file.toUpperCase() }).count();
  console.log(JSON.stringify({ file, id, w, box: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)], topAtCentre: top, refetched: hits - h0, errorLineLeft: left }));
  await pg.screenshot({ path: `${OUT}/d055-${file}-${id}-${w}-after-pointer.png` });
  await c.close();
}
{ // clusters.json blocked, S04 at the cluster phase
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await c.newPage();
  await pg.route("**/data/clusters.json", (r) => r.abort("failed"));
  await pg.goto(BASE, { waitUntil: "networkidle" }); await pg.keyboard.press("Escape");
  for (const p of [0.95, 0.99]) { await pg.evaluate((q) => window.__atlas.jumpTo("demand", q), p); await pg.waitForTimeout(3500); }
  const tabs = pg.locator("#demand [role=tab]"); const n = await tabs.count(); if (n >= 3) { await tabs.nth(2).click(); await pg.waitForTimeout(3500); }
  console.log("clusters@S04", n, JSON.stringify(await pg.evaluate(() => ({ chips: [...document.querySelectorAll("#demand .chip")].map((e) => e.textContent.trim()), errs: [...document.querySelectorAll("#demand .state-error")].map((e) => e.textContent.trim()), alerts: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim()), labels: [...document.querySelectorAll(".dem-label")].filter((e) => getComputedStyle(e).visibility !== "hidden").map((e) => e.textContent.trim()) }))));
  await pg.screenshot({ path: `${OUT}/d056-clusters-demand-phase2-1440.png` });
  await c.close();
}
await b.close();
