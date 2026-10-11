// P01-QA-007: (a) 768x1024-classic S03b p 0.8: title vs band row over time after the jump; (b) S08 footer vs nav at the true page bottom on laptops
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-6/probe";
const css = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #666; }";
{
  const b = await chromium.launch({ headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] });
  const c = await b.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), css);
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  for (const from of [0.55, 0.3]) {
    await p.evaluate((q) => window.__atlas.jumpTo("corridors", q), from); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__atlas.jumpTo("corridors", 0.8));
    const series = [];
    for (let t = 0; t <= 3000; t += 150) {
      series.push(await p.evaluate(() => { const ti = [...document.querySelectorAll("#corridors .dial-title")].filter((e) => +getComputedStyle(e).opacity > 0.15); const bands = [...document.querySelectorAll("#corridors .cor-bands [role=radio]")].map((e) => e.getBoundingClientRect()); const bb = Math.max(...bands.map((r) => r.bottom)); return ti.map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return `${e.className.includes("is-out") ? "out" : "in"}:${e.textContent.slice(0, 9)} top ${Math.round(r.top)} vs bands ${Math.round(bb)} op ${(+getComputedStyle(e).opacity).toFixed(2)}`; }).join(" | "); }));
      if (t === 1500) await p.screenshot({ path: `${OUT}/settle-768c-0.8-from${from}-1500.png` });
      await p.waitForTimeout(150);
    }
    console.log("768-classic from", from, "\n  " + series.join("\n  "));
  }
  await c.close(); await b.close();
}
{
  const b = await chromium.launch();
  for (const [w, h] of [[1280, 720], [1366, 768], [1440, 760], [1024, 768]]) {
    const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
    await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
    await p.evaluate(() => window.__atlas.jumpTo("closing", 0.95)); await p.waitForTimeout(2500);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(2500);
    const m = await p.evaluate(() => { const f = document.querySelector(".end-foot"); const n = document.querySelector(".nav-bar.is-fixed, .nav-bar"); const fr = f.getBoundingClientRect(), nr = n.getBoundingClientRect(); return { foot: [Math.round(fr.top), Math.round(fr.bottom)], nav: [Math.round(nr.top), Math.round(nr.bottom), Math.round(nr.left), Math.round(nr.right)], overlapY: Math.round(Math.min(fr.bottom, nr.bottom) - Math.max(fr.top, nr.top)), atBottom: Math.round(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }; });
    console.log("S08 bottom", w, h, JSON.stringify(m));
    await p.screenshot({ path: `${OUT}/s08-bottom-${w}x${h}.png` });
    await c.close();
  }
  await b.close();
}
