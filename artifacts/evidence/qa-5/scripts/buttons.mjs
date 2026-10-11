// P01-QA-006: L14 negative control + real-pointer clicks on the remaining buttons with an observable effect
import { chromium } from "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility/site/node_modules/@playwright/test/index.mjs";
const BASE = "http://localhost:4301/atlas-human-mobility/";
const b = await chromium.launch();
{ // L14 negative control: a 2000px element under mobile emulation must be reported against the configured width
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "width:2000px;height:10px"; document.body.appendChild(d); });
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: innerWidth }));
  console.log("L14 negative control", JSON.stringify(m), "configured 390 ->", m.sw > 390 ? "REPORTED" : "MISSED", "| clientWidth comparison ->", m.sw > m.cw ? "reported" : "missed");
  await c.close();
}
const pt = async (p, w, loc) => { const bb = await loc.boundingBox(); if (!bb) return "no box"; const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2; const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + String(e.className).slice(0, 30) + ":" + (e.textContent || "").trim().slice(0, 15) : "none"; }, [x, y]); if (w < 768) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); return top; };
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await c.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  const log = [];
  const jump = async (id, q, ms = 3000) => { await p.evaluate(([i, q]) => window.__atlas.jumpTo(i, q), [id, q]); await p.waitForTimeout(ms); };
  // OBS: PLAY, EXPLORE/EXIT, RESET VIEW
  await jump("observatory", 0);
  const how0 = await p.locator("#observatory").innerText().then((t) => (t.match(/[A-Z]{3} \d\d:\d\d/) || [""])[0]);
  let r = await pt(p, w, p.locator("#observatory").getByRole("button", { name: /^PLAY$/ }).first()); await p.waitForTimeout(2500);
  const how1 = await p.locator("#observatory").innerText().then((t) => (t.match(/[A-Z]{3} \d\d:\d\d/) || [""])[0]);
  log.push(`PLAY top=${r} hour ${how0} -> ${how1}`);
  const pause = p.locator("#observatory").getByRole("button", { name: /PAUSE/ }).first(); if (await pause.count()) { r = await pt(p, w, pause); await p.waitForTimeout(500); log.push(`PAUSE top=${r}`); }
  r = await pt(p, w, p.locator("#observatory").getByRole("button", { name: /^EXPLORE$/ }).first()); await p.waitForTimeout(800);
  const locked = await p.evaluate(() => getComputedStyle(document.documentElement).overflow);
  const exit = p.getByRole("button", { name: /EXIT/ }).first(); let r2 = (await exit.count()) ? await pt(p, w, exit) : "no EXIT"; await p.waitForTimeout(800);
  const unlocked = await p.evaluate(() => getComputedStyle(document.documentElement).overflow);
  log.push(`EXPLORE top=${r} overflow=${locked}; EXIT top=${r2} overflow=${unlocked}`);
  // LAYERS (phones) then RESET VIEW
  if (w < 768) { const lb = p.locator("#observatory").getByRole("button", { name: /LAYERS/ }).first(); if (await lb.count()) { r = await pt(p, w, lb); await p.waitForTimeout(800); log.push(`LAYERS top=${r} sheet radios visible=${await p.locator("#observatory [role=radio]").filter({ visible: true }).count()}`); } }
  const zone = p.locator("#observatory [role=radio]", { hasText: /^ZONE$/ }).filter({ visible: true }).first(); if (await zone.count()) { await pt(p, w, zone); await p.waitForTimeout(600); }
  const rv = p.locator("#observatory").getByRole("button", { name: /RESET VIEW/ }).filter({ visible: true }).first();
  if (await rv.count()) { r = await pt(p, w, rv); await p.waitForTimeout(800); log.push(`RESET VIEW top=${r} CITY checked=${await p.locator("#observatory [role=radio][aria-checked=true]", { hasText: /^CITY$/ }).count()}`); } else log.push("RESET VIEW not visible");
  // S05 RESET after slider change
  await jump("pressure", 0.5); const sl = p.locator("#pressure input[type=range]").first(); await sl.focus(); for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowRight"); await p.waitForTimeout(800);
  const v1 = await p.locator(".lab-result").innerText().catch(() => "");
  r = await pt(p, w, p.locator("#pressure").getByRole("button", { name: /^RESET$/ }).filter({ visible: true }).first()); await p.waitForTimeout(1200);
  log.push(`S05 RESET top=${r} ${v1.replace(/\n/g, " ").slice(0, 40)} -> ${(await p.locator(".lab-result").innerText().catch(() => "")).replace(/\n/g, " ").slice(0, 40)}`);
  // motion toggle + REPLAY INTRO + MENU pill
  await jump("city", 0.78, 1500);
  if (w < 768) { r = await pt(p, w, p.locator(".nav-pill.is-fixed .menu-pill")); await p.waitForTimeout(600); log.push(`MENU top=${r} open=${await p.locator("#menu-panel.is-open").count()}`); }
  const mot = p.locator(w < 768 ? "#menu-panel .nav__util" : ".nav-bar .nav__util", { hasText: /MOTION/ }).first();
  r = await pt(p, w, mot); await p.waitForTimeout(800); const m1 = await p.evaluate(() => document.documentElement.dataset.motion);
  if (w < 768 && !(await p.locator("#menu-panel.is-open").count())) { await pt(p, w, p.locator(".nav-pill.is-fixed .menu-pill")); await p.waitForTimeout(600); }
  await pt(p, w, mot); await p.waitForTimeout(800); const m2 = await p.evaluate(() => document.documentElement.dataset.motion);
  log.push(`MOTION top=${r} data-motion ${m1} -> ${m2}`);
  if (w < 768 && !(await p.locator("#menu-panel.is-open").count())) { await pt(p, w, p.locator(".nav-pill.is-fixed .menu-pill")); await p.waitForTimeout(600); }
  const rep = p.locator(w < 768 ? "#menu-panel .nav__util" : ".nav-bar .nav__util", { hasText: /REPLAY INTRO/ }).first();
  r = await pt(p, w, rep); await p.waitForTimeout(700); log.push(`REPLAY INTRO top=${r} SKIP INTRO shown=${await p.locator(".corner-btn").count()} scrollY=${await p.evaluate(() => Math.round(scrollY))}`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  // closing links
  await jump("closing", 0.95, 3500);
  const links = await p.locator("#closing .end-links a, #closing .end-links button").filter({ visible: true }).allInnerTexts();
  const obsL = p.locator("#closing .end-links a", { hasText: /OBSERVATORY/ }).first();
  if (await obsL.count()) { r = await pt(p, w, obsL); await p.waitForTimeout(2500); log.push(`closing links ${JSON.stringify(links)}; OPEN THE OBSERVATORY top=${r} hash=${await p.evaluate(() => location.hash)}`); }
  console.log(w, "\n  " + log.join("\n  "));
  await c.close();
}
await b.close();
