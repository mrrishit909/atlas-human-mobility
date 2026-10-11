import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: false });
for (const [w,h] of [[390,844],[360,800]]) {
const page = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
await page.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
await page.keyboard.press("Escape");
await page.evaluate(() => window.__atlas.jumpTo("observatory")); await page.waitForTimeout(4000);
const btn = page.locator(".obs-layers-btn");
const r = await btn.boundingBox();
const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + (e.className?.baseVal ?? e.className) : null; }, [r.x + r.width / 2, r.y + r.height / 2]);
const z = await btn.evaluate((e) => { const cs = getComputedStyle(e); return { z: cs.zIndex, pos: cs.position }; });
await btn.tap(); await page.waitForTimeout(800);
const open = await page.locator(".obs-sheet").count();
await page.screenshot({ path: `/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/qa/probe/obs-layers-${w}.png` });
console.log(w, JSON.stringify({ r, hit, z, sheetOpenAfterTap: open }));
// S04 label clipping
await page.evaluate(() => window.__atlas.jumpTo("demand")); await page.waitForTimeout(4000);
console.log(w, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".dem-label")].map((e) => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.left), Math.round(r.right), innerWidth]; }))));
await page.context().close();
}
await b.close();
