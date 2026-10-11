// P01-QA-004: at 768x1024 classic, LaGuardia step: does the dial title intercept clicks on the band selector?
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const css = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; }";
const b = await chromium.launch({ headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] });
const c = await b.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), css);
const p = await c.newPage();
await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
await p.evaluate(() => window.__atlas.jumpTo("corridors", 0.88)); await p.waitForTimeout(2500);
for (const name of ["MIDDAY", "PM PEAK", "EVENING"]) {
  const l = p.locator("#corridors .cor-bands [role=radio]", { hasText: name }).first();
  const r = await l.boundingBox();
  const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + String(e.className).slice(0, 30) + ":" + (e.textContent || "").trim().slice(0, 20) : null; }, [r.x + r.width / 2, r.y + r.height / 2]);
  await l.click({ timeout: 10000 }).catch((e) => console.log("click fail", e.message.split("\n")[0]));
  await p.waitForTimeout(800);
  console.log(name, "topmost:", top, "checked after click:", await l.getAttribute("aria-checked"));
}
await b.close();
