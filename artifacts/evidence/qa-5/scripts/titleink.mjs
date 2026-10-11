// P01-QA-006: per-glyph ink of the S03b "LaGuardia Airport" dial title (L16 painted pixels): per-character Range rects,
// screenshot, 95th-percentile luminance per glyph box (python step in titleink.py). Also checks the meta.json cold arrival.
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
import { writeFileSync } from "node:fs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-5/probe";
const css = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #666; }";
const res = [];
for (const [w, h, classic] of [[1920, 1080], [1024, 768], [1024, 768, true], [1280, 720], [1366, 768], [1440, 760], [1440, 900], [768, 1024], [390, 844]]) {
  const b = await chromium.launch(classic ? { headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] } : {});
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 });
  if (classic) await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), css);
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  for (const q of [0.8, 0.88, 0.95]) {
    await p.evaluate((q) => window.__atlas.jumpTo("corridors", q), q); await p.waitForTimeout(3000);
    const glyphs = await p.evaluate(() => { const t = document.querySelector("#corridors .dial-title:not(.is-out)"); const n = t.firstChild; const out = []; for (let i = 0; i < n.textContent.length; i++) { const ch = n.textContent[i]; if (ch === " ") continue; const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getBoundingClientRect(); out.push({ ch, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }); } const bands = [...document.querySelectorAll("#corridors .cor-bands, #corridors .cor-bands-m")].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none").map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cls: e.className }; }); const tb = [...document.querySelectorAll("#corridors .cor-bands [role=radio], #corridors .cor-bands-m [role=radio]")].map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }).filter((r) => r.right > r.left); return { text: t.textContent, glyphs: out, bands, bandText: tb }; });
    const f = `ink-${w}x${h}${classic ? "-classic" : ""}-${q}.png`;
    await p.screenshot({ path: `${OUT}/${f}` });
    res.push({ vp: `${w}x${h}${classic ? "-classic" : ""}`, q, file: f, ...glyphs });
  }
  await c.close(); await b.close();
}
// meta.json cold arrival at anatomy 0.9 (no visit to 0.65 first)
{
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await c.newPage();
    await p.route("**/data/meta.json", (r) => r.abort("failed"));
    await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.keyboard.press("Escape");
    await p.evaluate(() => window.__atlas.jumpTo("anatomy", 0.9)); await p.waitForTimeout(3500);
    const st = await p.evaluate(() => ({ alerts: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim().slice(0, 50)), lines: [...document.querySelectorAll("#anatomy .state-error")].map((e) => { const r = e.getBoundingClientRect(); return { inView: r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight, live: e.getAttribute("role") === "alert" }; }) }));
    console.log("meta cold anatomy 0.9", w, JSON.stringify(st));
    await p.screenshot({ path: `${OUT}/meta-cold-anatomy-0.9-${w}.png` });
    res.push({ metaCold: w, ...st });
    await c.close();
  }
  await b.close();
}
writeFileSync(`${OUT}/titleink.json`, JSON.stringify(res, null, 1));
