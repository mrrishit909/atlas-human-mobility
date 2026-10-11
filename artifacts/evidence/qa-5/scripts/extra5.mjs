// P01-QA-004 extras: skip link, S05 text numbers, network.json failure on the OBS NETWORK layer, meta.json failure
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-5/probe";
const BASE = "http://localhost:4301/atlas-human-mobility/";
const b = await chromium.launch();
const fi = (p) => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName} ${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}` : "none"; });
{ // skip link from a cold load
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  await p.goto(BASE, { waitUntil: "commit" }); await p.waitForTimeout(2500);
  const seq = []; for (let i = 0; i < 2; i++) { await p.keyboard.press("Tab"); seq.push(await fi(p)); }
  await p.keyboard.press("Enter"); await p.waitForTimeout(800); seq.push("after Enter: " + await fi(p));
  await p.keyboard.press("Tab"); seq.push("next Tab: " + await fi(p));
  console.log("SKIP", JSON.stringify(seq), "target exists:", await p.evaluate(() => !!document.getElementById("chapters")));
  await c.close();
}
{ // S05 statement text
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
  for (const q of [0.1, 0.5]) { await p.evaluate((q) => window.__atlas.jumpTo("pressure", q), q); await p.waitForTimeout(2500); console.log("S05", q, (await p.locator("#pressure").innerText()).replace(/\n/g, " | ").slice(0, 700)); }
  await p.evaluate(() => window.__atlas.jumpTo("evidence", 0.95)); await p.waitForTimeout(2000);
  console.log("S07 0.95", (await p.locator("#evidence").innerText()).replace(/\n/g, " | ").match(/K = \d[^|]*/)?.[0]);
  // S06: each future, the most/least line vs minutes list
  for (const name of ["A BUSIER YEAR", "A LANE LOST", "A QUIETER CITY"]) {
    await p.evaluate(() => window.__atlas.jumpTo("futures", 0.5)); await p.waitForTimeout(1500);
    await p.locator(".fut-select [role=radio]", { hasText: name }).first().click(); await p.waitForTimeout(2000);
    const t = await p.locator("#futures").innerText();
    console.log("S06", name, "::", (t.match(/At [A-Z]{3} \d\d:\d\d:[^\n]*\n?[^\n]*/) || [""])[0].replace(/\n/g, " "), "::", (t.match(/QUEENS[\s\S]*?CITYWIDE[^\n]*/) || [""])[0].replace(/\n/g, " "));
    if (name === "A QUIETER CITY") await p.screenshot({ path: `${OUT}/s06-quieter-1440.png` });
  }
  await c.close();
}
for (const [file, id, p0, layer] of [["network.json", "observatory", 0, "NETWORK"], ["meta.json", "anatomy", 0.5, null], ["meta.json", "closing", 0.95, null]]) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  let hits = 0; await p.route(`**/data/${file}`, (r) => { hits++; return r.abort("failed"); });
  await p.goto(BASE, { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
  await p.evaluate(([i, q]) => window.__atlas.jumpTo(i, q), [id, p0]); await p.waitForTimeout(3000);
  if (layer) { await p.locator("#observatory [role=radio]", { hasText: layer }).first().click().catch((e) => console.log("click fail", e.message.split("\n")[0])); await p.waitForTimeout(3000); }
  const alerts = await p.locator("[role=alert]").allInnerTexts();
  const lines = await p.locator(`#${id} .state-error`).allInnerTexts();
  console.log("ERR", file, id, layer, "hits", hits, "alerts", JSON.stringify(alerts), "scene error lines", JSON.stringify(lines));
  await p.screenshot({ path: `${OUT}/error-${file}-${id}${layer ? "-" + layer : ""}-1440.png` });
  await c.close();
}
await b.close();
