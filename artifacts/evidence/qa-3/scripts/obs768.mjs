// P01-QA-004: OBS rail reachability at 768x1024 (and 1024x768): are off-screen rail controls reachable?
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const OUT = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/artifacts/evidence/recordings/qa-3/probe";
const b = await chromium.launch();
for (const [w, h] of [[768, 1024]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const p = await c.newPage();
  await p.goto("http://localhost:4301/atlas-human-mobility/", { waitUntil: "networkidle" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  await p.evaluate(() => window.__atlas.jumpTo("observatory", 0)); await p.waitForTimeout(3500);
  const info = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("#observatory button, #observatory input")].filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0);
    return btns.map((e) => { const r = e.getBoundingClientRect(); let sc = e.parentElement; while (sc && sc.id !== "observatory" && !(sc.scrollWidth > sc.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowX))) sc = sc.parentElement; return { t: (e.textContent || e.getAttribute("placeholder") || "").trim().slice(0, 20), l: Math.round(r.left), r: Math.round(r.right), top: Math.round(r.top), off: r.right > innerWidth || r.left < 0, scroller: sc && sc.id !== "observatory" ? sc.className.slice(0, 40) : null }; });
  });
  const off = info.filter((x) => x.off);
  console.log(w, h, "offscreen:", JSON.stringify(off));
  for (const name of ["YOUR FUTURE", "ZONE", "RESET VIEW", "OFF"]) {
    const l = p.locator("#observatory").getByRole(name === "RESET VIEW" ? "button" : "radio", { name, exact: true }).first();
    if (!(await l.count())) { console.log(name, "not found as button"); continue; }
    await l.focus(); await p.waitForTimeout(300);
    const r = await l.boundingBox();
    let clicked = "n/a";
    if (name !== "YOUR FUTURE") { const hitEl = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 30) + ':' + (e.textContent || '').trim().slice(0, 20) : null; }, [r.x + r.width / 2, r.y + r.height / 2]); console.log('  topmost at centre:', hitEl); try { await l.click({ timeout: 8000 }); clicked = "ok"; } catch (e) { clicked = "FAIL " + e.message.split("\n")[0]; } }
    console.log(name, "after focus box", JSON.stringify(r && { l: Math.round(r.x), r: Math.round(r.x + r.width) }), "click", clicked, "disabled", await l.getAttribute("aria-disabled"));
  }
  await p.screenshot({ path: `${OUT}/obs-${w}x${h}-after-focus.png`, timeout: 90000 }).catch((e) => console.log("shot failed", e.message.split("\n")[0]));
  await c.close();
}
await b.close();
