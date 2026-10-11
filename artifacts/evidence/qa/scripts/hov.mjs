import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: false });
const out = [];
for (const rm of [false, true]) for (const [w, h] of [[1440, 900], [390, 844], [1024, 768]]) {
  const page = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: rm ? "reduce" : "no-preference" })).newPage();
  await page.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  const per = {};
  for (const id of ["city","anatomy","rush-hour","corridors","demand","pressure","futures","evidence","observatory","closing"]) {
    if (rm) await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: "instant" }), id); else await page.evaluate((i) => window.__atlas.jumpTo(i), id);
    await page.waitForTimeout(id === "demand" ? 3000 : 900);
    per[id] = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > cw + 1 && r.width > 0 && getComputedStyle(e).visibility !== "hidden"; }).slice(0, 4).map((e) => (e.className?.baseVal ?? e.className) + ":" + Math.round(e.getBoundingClientRect().right));
      const labels = [...document.querySelectorAll(".dem-label, .map-label, [class*=label]")].filter((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && /·\s[\d,]{5,}/.test(e.textContent) && getComputedStyle(e).opacity !== "0" && getComputedStyle(e).visibility !== "hidden"; }).map((e) => e.className + "|" + e.textContent.slice(0, 40));
      return { sw, cw, wide, labels };
    });
  }
  out.push({ rm, w, per });
  await page.context().close();
}
console.log(JSON.stringify(out, null, 0));
await b.close();
