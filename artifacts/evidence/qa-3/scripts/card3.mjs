// P01-QA-004: S02 card 3 centred (p 0.5) on phones and T: text boxes of title, ledger rows, check line, body
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-3/probe";
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [375, 812], [360, 800], [768, 1024]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 768 });
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  await p.evaluate(() => window.__atlas.jumpTo("anatomy", 0.5)); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const card = [...document.querySelectorAll(".story-card")].find((e) => /WHAT WE REMOVED/.test(e.textContent));
    const box = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const q = rg.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), top: q.top, b: q.bottom, l: q.left, r: q.right }; };
    const els = [card.querySelector(".story-card__title"), ...card.querySelectorAll(".a-ledger tr"), card.querySelector(".a-ledger__check"), ...card.querySelectorAll("p")].filter(Boolean);
    const bs = [...new Set(els)].map(box);
    const hits = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.top, c.top); if (ox > 1 && oy > 1) hits.push(`${a.t} x ${c.t} (${ox.toFixed(0)}x${oy.toFixed(0)})`); }
    const cr = card.getBoundingClientRect();
    return { hits, card: [Math.round(cr.left), Math.round(cr.right)] };
  });
  console.log(w, h, JSON.stringify(r));
  await p.screenshot({ path: `${OUT}/card3-${w}x${h}-0.5.png` });
  await c.close();
}
await b.close();
