import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await c.newPage();
  let hits = 0, block = true; await p.route("**/data/network.json", (r) => { hits++; return block ? r.abort("failed") : r.continue(); });
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
  await p.evaluate(() => window.__atlas.jumpTo("observatory", 0)); await p.waitForTimeout(3500);
  const radios = await p.evaluate(() => [...document.querySelectorAll("#observatory [role=radio]")].filter((e) => e.textContent.trim() === "NETWORK").map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }; }));
  let t = radios.find((r) => r.vis);
  if (!t && w < 768) { const lb = await p.evaluate(() => { const e = [...document.querySelectorAll("#observatory button")].find((b) => /LAYERS/.test(b.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); if (lb) { await p.touchscreen.tap(lb.x, lb.y); await p.waitForTimeout(800); } const r2 = await p.evaluate(() => [...document.querySelectorAll("#observatory [role=radio]")].filter((e) => e.textContent.trim() === "NETWORK").map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }; })); t = r2.find((r) => r.vis); }
  if (!t) { console.log(w, "no visible NETWORK radio", JSON.stringify(radios)); await c.close(); continue; }
  if (w < 768) await p.touchscreen.tap(t.x, t.y); else await p.mouse.click(t.x, t.y);
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => ({ checked: [...document.querySelectorAll("#observatory [role=radio][aria-checked=true]")].map((e) => e.textContent.trim()), alerts: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim().slice(0, 50)) }));
  const btn = p.locator("#observatory .state-error", { hasText: "NETWORK.JSON" }).getByRole("button", { name: /RETRY/ }).first();
  const bb = await btn.boundingBox(); let re = null;
  if (bb) { block = false; const h0 = hits; if (w < 768) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(3000); re = { refetch: hits - h0, left: await p.locator("#observatory .state-error", { hasText: "NETWORK.JSON" }).count() }; }
  console.log(w, JSON.stringify(st), JSON.stringify(re));
  await p.screenshot({ path: `/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-6/probe/net5-${w}.png` });
  await c.close();
}
await b.close();
