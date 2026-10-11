import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-4/probe";
const b = await chromium.launch();
for (const file of ["network.json", "clusters.json", null]) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await c.newPage(); let hits = 0;
  if (file) await pg.route(`**/data/${file}`, (r) => { hits++; return r.abort("failed"); });
  await pg.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await pg.keyboard.press("Escape");
  for (const p of [0.95, 0.99]) { await pg.evaluate((q) => window.__atlas.jumpTo("demand", q), p); await pg.waitForTimeout(4000); }
  console.log(file, "hits", hits, JSON.stringify(await pg.evaluate(() => ({ chips: [...document.querySelectorAll("#demand .chip")].map((e) => e.textContent.trim()), errs: [...document.querySelectorAll("#demand .state-error")].map((e) => e.textContent.trim()), labels: [...document.querySelectorAll(".dem-label")].filter((e) => getComputedStyle(e).visibility !== "hidden").map((e) => e.textContent.trim()) }))));
  await pg.screenshot({ path: `${OUT}/d056-demand-0.99-${file ?? "control"}-1440.png` });
  await c.close();
}
await b.close();
