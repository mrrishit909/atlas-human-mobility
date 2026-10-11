// P01-QA-004: S03b LaGuardia step at 768x1024 with a classic scrollbar: dial title vs band selector boxes
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-3/probe";
const css = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #666; }";
for (const [w, h, classic] of [[768, 1024, true], [768, 1024, false], [1024, 768, true], [800, 1024, true], [790, 1024, false]]) {
  const b = await chromium.launch(classic ? { headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] } : {});
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  if (classic) await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), css);
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  for (const q of [0.8, 0.88, 0.95]) {
    await p.evaluate((q) => window.__atlas.jumpTo("corridors", q), q); await p.waitForTimeout(2500);
    const m = await p.evaluate(() => {
      const vis = (e) => { const cs = getComputedStyle(e); return cs.display !== "none" && +cs.opacity > 0.1 && e.getBoundingClientRect().width > 0; };
      const titles = [...document.querySelectorAll("#corridors .dial-title")].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), top: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; });
      const bands = [...document.querySelectorAll("#corridors .cor-bands")].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; });
      const chips = [...document.querySelectorAll("#corridors .cor-text .chip")].filter(vis).length;
      return { cw: document.documentElement.clientWidth, titles, bands, chips };
    });
    const hit = m.titles.some((t) => m.bands.some((x) => t.top < x.b && x.top < t.b && t.l < x.r && x.l < t.r));
    console.log(JSON.stringify({ w, h, classic, q, hit, ...m }));
    if (hit) await p.screenshot({ path: `${OUT}/d047-${w}x${h}${classic ? "-classic" : ""}-corridors-${q}.png` });
  }
  await b.close();
}
