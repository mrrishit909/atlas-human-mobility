import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const [,, w, h, id, ps, out, extra] = process.argv;
const b = await chromium.launch({ headless: false });
const c = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: +w < 1024, isMobile: +w < 768, deviceScaleFactor: 1 });
const p = await c.newPage();
await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
for (const q of ps.split(",")) {
  await p.evaluate(([i, q]) => window.__atlas.jumpTo(i, +q), [id, q]); await p.waitForTimeout(2200);
  if (extra) console.log(q, await p.evaluate(new Function(`return (${extra})`)));
  await p.screenshot({ path: `${out}-${q}.png` });
}
await b.close();
