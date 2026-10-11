// P01-QA-004: S03b LaGuardia step on phones: dial title vs honesty chips
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-3/probe";
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [375, 812], [360, 800]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  for (const q of [0.8, 0.9]) {
    await p.evaluate((q) => window.__atlas.jumpTo("corridors", q), q); await p.waitForTimeout(2500);
    const m = await p.evaluate(() => {
      const vis = (e) => { const cs = getComputedStyle(e); return cs.display !== "none" && +cs.opacity > 0.1 && e.getBoundingClientRect().width > 0; };
      const R = (e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 40), top: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
      const titles = [...document.querySelectorAll("#corridors .dial-title")].filter(vis).map(R);
      const chips = [...document.querySelectorAll("#corridors .cor-text .chip")].filter(vis).map(R);
      return { titles, chips, hits: titles.flatMap((t) => chips.filter((x) => t.top < x.b - 1 && x.top < t.b - 1 && t.l < x.r && x.l < t.r).map((x) => `${t.t} x ${x.t} (${Math.min(t.b, x.b) - Math.max(t.top, x.top)}px)`)) };
    });
    console.log(w, h, q, JSON.stringify(m.hits), JSON.stringify(m.titles));
    await p.screenshot({ path: `${OUT}/d047-${w}x${h}-corridors-${q}.png` });
  }
  await c.close();
}
await b.close();
