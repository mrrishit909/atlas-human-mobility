// P01-QA-007: S08 footer vs fixed nav at the page bottom, reduced motion, 1280x720
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" }); const p = await c.newPage();
await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await p.waitForTimeout(1000);
await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(2000);
console.log("rm 1280x720 bottom", JSON.stringify(await p.evaluate(() => { const f = document.querySelector(".end-foot").getBoundingClientRect(), n = document.querySelector(".nav-bar").getBoundingClientRect(); return { foot: [Math.round(f.top), Math.round(f.bottom)], nav: [Math.round(n.top), Math.round(n.bottom)], overlapY: Math.round(Math.min(f.bottom, n.bottom) - Math.max(f.top, n.top)) }; })));
await p.screenshot({ path: "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-6/probe/s08-bottom-1280x720-rm.png" });
await b.close();
