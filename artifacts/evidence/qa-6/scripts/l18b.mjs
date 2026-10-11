// P01-QA-007 L18: S04 metric switch, every animation frame: legend basis vs the basis of the labels on screen (opacity-weighted)
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-6/probe";
const SIG = { PICKUPS: "6,247,112", DROPOFFS: "5,716,719", NET: "1,802,804" };
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
  await p.evaluate(() => window.__atlas.jumpTo("demand", 0.89)); await p.waitForTimeout(4000);
  let prev = "PICKUPS";
  for (const metric of ["DROPOFFS", "NET", "PICKUPS"]) {
    const bb = await p.locator('[role=radiogroup][aria-label="Height metric"] [role=radio]', { hasText: metric }).first().boundingBox();
    await p.evaluate((SIG) => { const tok = (window.__tok = (window.__tok || 0) + 1); window.__f = []; let t0 = null; window.__t0 = () => { t0 = performance.now(); }; const tick = () => { if (window.__tok !== tok) return; const sec = document.getElementById("demand"); const legend = ([...sec.querySelectorAll("p, span")].map((e) => e.textContent.trim()).find((t) => /^HEIGHT = /.test(t)) ?? ""); const labs = [...document.querySelectorAll(".dem-label")].map((e) => { let o = e, op = 1; while (o && o.nodeType === 1) { const cs = getComputedStyle(o); if (cs.visibility === "hidden" || cs.display === "none") { op = 0; break; } op *= +cs.opacity; o = o.parentElement; } return { t: e.textContent.trim(), op }; }).filter((x) => x.op > 0.5); const basis = Object.entries(SIG).filter(([, v]) => labs.some((l) => l.t.includes(v))).map(([k]) => k); window.__f.push({ ms: t0 === null ? -1 : Math.round(performance.now() - t0), legend, basis }); if (window.__f.length < 200) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, SIG);
    await p.evaluate(() => window.__t0());
    if (w < 768) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await p.waitForTimeout(3000);
    const f = await p.evaluate(() => window.__f);
    const legendNew = (l) => (metric === "NET" ? l.includes("|") : l.includes(metric));
    const mixed = f.filter((x) => legendNew(x.legend) && x.basis.includes(prev));
    const firstNew = f.find((x) => legendNew(x.legend)), lastOld = mixed[mixed.length - 1];
    console.log(w, prev, "->", metric, "frames", f.length, "| legend new at", firstNew?.ms, "ms | frames with new legend but old-basis labels at opacity > 0.5:", mixed.length, mixed.length ? `(${mixed[0].ms}..${lastOld.ms} ms)` : "");
    prev = metric;
  }
  await c.close();
}
await b.close();
