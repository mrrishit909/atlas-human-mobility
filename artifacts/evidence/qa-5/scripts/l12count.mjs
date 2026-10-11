// P01-QA-006: replicate site/e2e/l12.spec.ts "every control" at 768x1024 and print per-landing counts and any covered control
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const L = [["city", 0.78], ["anatomy", 0.14], ["rush-hour", 0.35], ["corridors", 0.3], ["corridors", 0.88], ["demand", 0.89], ["pressure", 0.5], ["futures", 0.5], ["evidence", 0.5], ["observatory", 0], ["closing", 0.9]];
const b = await chromium.launch();
for (const settle of [1500, 4000]) {
  const c = await b.newContext({ viewport: { width: 768, height: 1024 } }); const page = await c.newPage();
  let total = 0; const per = [], bad = [];
  for (const [s, p] of L) {
    await page.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" }); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await page.evaluate(([s, p]) => window.__atlas.jumpTo(s, p), [s, p]); await page.waitForTimeout(settle);
    const f = await page.evaluate(() => { const out = []; let n = 0; for (const el of document.querySelectorAll("button, a[href], [role=radio], [role=tab], input, [role=combobox]")) { if (el.closest("[aria-hidden=true], [inert]") || el.disabled) continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; let o = el, op = 1; while (o) { const cs = getComputedStyle(o); if (cs.visibility === "hidden" || cs.display === "none") { op = 0; break; } op *= +cs.opacity; o = o.parentElement; } if (op < 0.5) continue; n++; const top = document.elementFromPoint(x, y); if (!top || !(top === el || el.contains(top))) out.push(`${el.textContent.trim().slice(0, 20)} under ${top?.tagName}.${String(top?.className).slice(0, 30)}`); } return { n, out }; });
    total += f.n; per.push(`${s}@${p}:${f.n}`); bad.push(...f.out.map((x) => `${s}@${p} ${x}`));
  }
  console.log(`settle ${settle}ms total ${total}`, per.join(" "), "covered:", JSON.stringify(bad));
  await c.close();
}
await b.close();
