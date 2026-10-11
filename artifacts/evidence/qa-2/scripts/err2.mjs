import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const O = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/qa-2/probe";
const b = await chromium.launch({ headless: false });
for (const [file, id, p] of [["facts.json", "city", 0.78], ["od_ring_top.json", "city", 0.3], ["od_matrix_totals.json", "observatory", 0]]) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await c.newPage();
  let block = true, hits = 0;
  await pg.route(`**/data/${file}`, (r) => { hits++; return block ? r.abort("failed") : r.continue(); });
  await pg.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
  await pg.evaluate(([i, q]) => window.__atlas.jumpTo(i, q), [id, p]); await pg.waitForTimeout(3000);
  if (id === "observatory") { const s = pg.getByRole("combobox"); await s.fill("JFK"); await s.press("Enter"); await pg.waitForTimeout(2500); }
  const al = await pg.evaluate(() => [...document.querySelectorAll("[role=alert]")].map((a) => { const r = a.getBoundingClientRect(); return { text: a.innerText.slice(0, 80), section: a.closest("section")?.id, inView: r.bottom > 0 && r.top < innerHeight && r.width > 0 }; }));
  await pg.screenshot({ path: `${O}/err2-${file}-${id}.png` });
  console.log(file, id, "hits", hits, JSON.stringify(al));
  await c.close();
}
await b.close();
