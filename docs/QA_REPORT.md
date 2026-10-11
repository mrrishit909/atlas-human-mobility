# QA report: P01 Atlas of Human Mobility (task P01-QA-002)

Independent visual, analytical, UX and performance QA. Reviewer: qa-reviewer (did not build the site).
Date: 2026-10-10 (22:17 to 22:55 EDT). Product code audited: `site/src`, `site/index.html` and `site/public` at
commit 0175811. At the end of the session HEAD was b2f7169, but that commit only merges the other QA agent's test
files, so the product source is identical. Build: `npm run build` (vite 8.3.4). Served with
`npx vite preview --port 4301 --strictPort`, which serves the production bundle uncompressed. The dev server was never used.

**Verdict: FAILED.** The register has 7 major defects and no blockers. The site is distinctive, honest in its numbers
(26 of 26 spot checks match), and has working controls and states. It fails the release gate on these points:

- **Responsiveness.** Text collides at 1024x768. Text and numbers are clipped at the phone widths.
- **Honesty tags.** The S01 chips are hidden on phones.
- **Reduced motion.** S04 labels leak onto the S05 chart, and the page scrolls sideways on phones.
- **Mobile LCP.** It misses the target in 2 of 3 Lighthouse runs. Those runs were on a heavily loaded machine.

Machine: Mac15,6 (Apple silicon, 120 Hz display). Other agents were running Python pipelines and Playwright for the
whole session, with load averages between 10 and 71. The load is recorded next to every performance number below.

## 1. Release gate

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | PASS (with defects) | Art-directed, not a template. One luminous form per scene: ring, orb, Solar glow, Spectral rim. Serif statements over uppercase mono, and every scene has its own composition (contact sheets at all 7 viewports). The layout defects are logged under Responsiveness. |
| Motion UI (6 layers) | PASS | **Intro:** blur-to-sharp headline and the ring forming from chords (`probe/intro-*`). **Nav:** instant jump plus stage fade. **Scroll storytelling:** scrubbed ring zoom and story deck. **Component:** dial steps, lab tweens, bottom sheets. **Data transitions:** keyed HEIGHT change, S03a size tween, S06 swell. **Microinteractions:** chip pulse, RESET confirmation. **Frame pacing** (§5): p95 10.4 ms on desktop, 21.1 to 21.6 ms at 4x CPU. |
| UX | PASS (with minor defects) | Nav, MENU pill and deep links work. OBS search goes to the inspector, Esc closes it and focus returns. EXPLORE locks scroll and Esc restores the same scrollY (18000 before and after). A wheel over the OBS map outside EXPLORE scrolls the page (18000 to 18799). The OBS readout reconciles with the region sum (e2e passed). Keyboard defects: D-012, D-013. |
| Functionality and states | PASS (with minor defects) | Error and RETRY were verified for 7 artifacts: each fetch was aborted, the error line and RETRY appeared, RETRY re-fetched exactly once and recovered (`probe/error-*`). Controls are disabled while bpr_fit is missing. RESET restores 8.8 to 8.8 mph. YOUR FUTURE is enabled only after a lab change. The od_matrix_totals error path was **not exercised**: it was never requested on the tested path. |
| AI / analytical honesty | **FAIL** | 26 on-screen numbers match facts.json, and I recomputed 12 of them independently from the raw artifacts (§3). The BPR lab output matches my independent recompute (Queens x1.5 / -30%: 4.8 mph and 38 min). However, the S01 OBSERVED and DERIVED chips are `display:none` on phones (D-002). S04 numbers are truncated off-screen on phones (D-004). |
| Performance | **FAIL** (load-confounded) | Lighthouse mobile LCP was 2571, 2262 and 2559 ms (median 2559, target 2500). Mobile perf was 0.81, 0.98 and 0.96. Desktop perf was 0.86, 0.98 and 1.00. CLS was 0.013 or lower, and a11y was 1.00 in every run. Load averages were 13 to 20 during these runs (§5). |
| Responsiveness (3 deliberate compositions plus 7 viewports) | **FAIL** | D, T and M are genuinely different compositions (T text above the ring, M bottom sheets, S06 rotated split). At 1024x768, however, text collides in S01, S03a, S03b and S06 (D-001), and phone widths clip text and numbers (D-004, D-008). |
| Professional quality | **FAIL** at HEAD | `tsc --noEmit` is clean and Vitest passes 65/65. ESLint has **2 errors** in `e2e/motion/{intro,scroll}.spec.ts`, which came from the other QA merge (D-018). The project e2e suites ran 47 passed, 1 failed and 22 skipped (D-019). axe has 1 serious violation at the CITY landing state (D-006) and 0 in every other scene, in both normal and reduced motion. All 8 required docs and README.md are present. |
| GitHub | BLOCKED | 24 local commits on main, but `git remote -v` is empty. Publishing is a later phase. |
| Deployment | BLOCKED | Out of scope for this task (not deployed). Performance must be re-measured on the gzip-serving Pages URL. |
| Portfolio | BLOCKED | Out of scope for this task. |

## 2. Defect register (severity-ranked)

### Major

**P01-D-001: Text collisions at 1024x768 in four scenes** (major)
- **Files:** `site/src/styles/scenes.css` (the D-class layout below 1440 width); the ring geometry per viewport class in `site/src/graphics/ring.ts` (`viewportClass`); `freeBox` in `site/src/scenes/S06Futures.tsx`.
- **Viewport:** 1024x768.
- **Repro:** `window.__atlas.jumpTo(id)` for city (0.78), rush-hour (0.35), corridors (0.3) and futures (0.5).
- **Expected:** no text overlaps text, ring nodes or cards. Hard rejection #9 requires deliberate compositions, and 1024x768 is a required viewport.
- **Actual:**
  - **S01:** card 2 covers "zones" and "another." of the statement, and the arc runs through the statement.
  - **S03a:** the 07:00 / 35,115 PICKUPS / HOUR readout sits on top of the body copy, and the ring crosses the text column.
  - **S03b:** the dial title "The airports" runs into "the city's hidden". The anchor marker and arc cross the body text and the ledger. The tickets are clipped at the right edge.
  - **S06:** the split ring cuts through the callout ("saves."), and the hatched delta bars overprint the borough names.
- **Evidence:** `artifacts/evidence/qa/screenshots/1024x768/seq-city-02.png`, `seq-rush-hour-01.png`, `seq-corridors-01.png`, `seq-futures-01.png`.
- **Verification test:** extend the bbox specs (`b2.spec.ts` S05/S06 bbox) to run at 1024x768 for S01, S03a, S03b and S06. Assert that statement, body, ledger and card rects do not intersect each other or the ring's text-free box.

**P01-D-002: S01 honesty tags hidden on phones** (major, honesty)
- **File:** `site/src/styles/scenes.css:58` (`.city-cards .note__tag { display: none; }` in the M media query).
- **Viewports:** 390x844, 375x812 and 360x800.
- **Repro:** load the page at 390x844 and land on CITY.
- **Expected:** every data visual carries its tag (hard rejection #15). Card 1 is OBSERVED and card 2 is DERIVED.
- **Actual:** "1,806 PICKUPS..." and "532 RIDES BEGAN..." render with no tag.
- **Evidence:** `artifacts/evidence/qa/screenshots/390x844/seq-city-02.png`, `screenshots/360x800/seq-city-02.png`.
- **Verification test:** at 390x844, for every element that contains a number from facts.json, assert that a visible `.chip` exists in the same card or stage. Visible means non-zero size and not `display:none`.

**P01-D-003: S03b destination tickets collide and run off-screen** (major)
- **File:** the ticket layout in `site/src/scenes/S03bCorridors.tsx` (`.cor-tickets`; the 1D greedy collision pass).
- **Viewports:** 1920x1080, 1440x900 and 1024x768.
- **Repro:** jump to corridors 0.3 (airports) or 0.55 (Brooklyn).
- **Expected:** at least 8px gap between tickets, clamped 16px from the sides (VISUAL_DESIGN 3.3).
- **Actual:**
  - Tickets abut or overlap, and the next ticket's arrow covers the last digit: "142,829" reads as "142,82" and "216,536" reads as "216,53".
  - The last ticket runs past the right edge ("128,580 → WILLIAMSBURG (SOUTH SIDE) ·" at 1440; "MIDTOWN CENTER ·" at 1920; "15'" at 1024).
- **Evidence:** `screenshots/1440x900/seq-corridors-02.png`, `screenshots/1920x1080/seq-corridors-01.png`, `screenshots/1024x768/seq-corridors-01.png`.
- **Verification test:** for each anchor state and band at D/T, collect `.ticket` rects and assert pairwise gap of 8px or more, `left >= 16` and `right <= innerWidth - 16`.

**P01-D-004: S04 reference-height labels truncated at phone widths** (major, data legibility)
- **Files:** `computeLabels` and the label CSS in `site/src/scenes/S04Demand.tsx` (`.dem-label`).
- **Viewports:** 390x844 and 360x800 (375x812 visually the same).
- **Repro:** jump to demand landing (0.89).
- **Expected:** labels stay inside the viewport and numbers are fully visible.
- **Actual:**
  - Label right edges are 413, 377 and 412 px against a 390 viewport, and 383, 354 and 387 px against 360.
  - The visible text reads "JFK AIRPORT · 6,24", "WASHINGTON HEIGHTS SOUTH · 1,87" and "3,433,53". A truncated number reads as a different number.
  - The map is also pushed against the right edge, so Queens is cut off.
- **Evidence:** `screenshots/390x844/seq-demand-03.png`, `screenshots/360x800/seq-demand-03.png`. The measurements are in this report (from `scripts/layers.mjs`).
- **Verification test:** assert that every `.dem-label` rect satisfies `left >= 16 && right <= innerWidth - 16` at 390, 375 and 360.

**P01-D-005: Reduced motion breaks layout: S04 labels on the S05 chart, and the page scrolls sideways on phones** (major)
- **Files:** S04 label layer (`S04Demand.tsx`, `.dem-label`) not unmounted or hidden off-stage under `data-motion="off"`; `.chip--simulated` `white-space: nowrap` with no overflow containment in `.lab-stage__head` (scenes.css).
- **Viewports:** 1440x900, 390x844 and 1024x768 (labels only appear at 1440 and 390).
- **Repro:** `reducedMotion: 'reduce'`, then scroll to `#pressure`.
- **Expected:** S05 shows only its own chart, and there is no horizontal scroll (MOTION_SYSTEM 8).
- **Actual:**
  - Three S04 labels ("WASHINGTON HEIGHTS SOUTH · 1,870,270", "UPPER EAST SIDE NORTH · 3,433,535", "JFK AIRPORT · 6,247,112") draw on top of the BPR chart and overlap each other.
  - Document scrollWidth is 604 against a clientWidth of 375 on phones: the whole page pans sideways by 229px.
  - At 1440 there is a 1px overflow (1426 against 1425), and a horizontal scrollbar is visible.
- **Evidence:** `probe/rm-1440-pressure.png`, `probe/rm-390-pressure.png`, `probe/overflow-labels.json`.
- **Verification test:** under reduced motion at each viewport, for every scene:
  - assert `documentElement.scrollWidth <= clientWidth`;
  - assert no `.dem-label` is visible outside `#demand`.

**P01-D-006: The CITY nav landing (p 0.78) shows card 2 half-revealed** (major)
- **File:** the word-reveal windows in `site/src/scenes/S01City.tsx` (card 2 scrubs 0.74 to 0.92) against landing 0.78 in `site/src/app/scenes.ts`.
- **Viewports:** all of them.
- **Repro:** click CITY in the nav.
- **Expected:** a landing state never shows a half-revealed state (MOTION_SYSTEM 6.2).
- **Actual:**
  - Card 2 reads "532 RIDES" followed by blurred ghost words. The DERIVED headline total "280,236,580 IN ALL" is not readable.
  - axe reports **color-contrast (serious)**: 5 nodes at 3.72:1 (#285365 on #58b8e1), at 1440 and 390.
- **Evidence:** `screenshots/1920x1080/seq-city-02.png`, `screenshots/1024x768/seq-city-02.png`, `screenshots/390x844/seq-city-02.png`, `probe/probe-results.json` (`axe`, scene `city`).
- **Verification test:** jump to CITY, wait 400ms, then:
  - assert every `.note__body .wr-word` has opacity 1 and filter none;
  - run axe on `#city` with zero serious violations.

**P01-D-007: Mobile Lighthouse LCP over 2.5s in 2 of 3 runs** (major, gate; load-confounded)
- **Files:** font loading (`index.html` preload of the 132 KB Newsreader opsz variable woff2); main chunk.
- **Viewport:** Lighthouse mobile preset.
- **Repro:** `~/data-frontier/shared/testing/run-lighthouse.sh http://localhost:4301/atlas-human-mobility/ <out>` three times.
- **Expected:** LCP of 2.5s or less and perf of 90 or more (hard rejection #7).
- **Actual:**

  | Run | Mobile LCP | Mobile perf | Desktop perf | TBT mobile / desktop | Load average |
  |---|---|---|---|---|---|
  | 1 | 2571 ms | 0.81 | 0.86 | 608 / 327 ms | 13.5 to 16.0 |
  | 2 | 2262 ms | 0.98 | 0.98 | 88 / 133 ms | 15.1 to 20.0 |
  | 3 | 2559 ms | 0.96 | 1.00 | 15 / 0 ms | 19.3 to 19.4 |

  - Mobile FCP is 1.5 to 1.7s. The LCP element is `h1#hero-title > span.wr-word` ("journeys.").
  - The load confounds these numbers, so this could pass on an idle machine. As measured, it fails.
- **Evidence:** `artifacts/evidence/qa/lighthouse/{desktop,mobile}.report.{json,html}`, `lighthouse-run2/*.json`, `lighthouse-run3/*.json`.
- **Verification test:** 5 Lighthouse mobile runs on an idle machine (load average under 4) and on the deployed gzip URL. Assert median LCP of 2500 ms or less and perf of 0.90 or more. A smaller display-font subset is the likely fix.

### Minor

**P01-D-008: S05 SIMULATED chip text overflows (known item: CONFIRMED and wider than reported)**
- **Files:** `.chip--simulated` (`white-space: nowrap`) inside `.lab-stage__head` (scenes.css).
- **Viewports:**
  - At 390x844, 375x812 and 360x800 the chip's right edge is 604px.
  - At 1024x768 it is 1188px against a 1024 viewport.
  - The head's scrollWidth is 588 against a clientWidth of 313 to 343.
- **Actual:** the detail text is cut after "FITTE" (phones) and after "FITTED TO 2" (1024). The SIMULATED word itself stays visible. Under reduced motion this same chip is what drives the sideways page scroll (D-005).
- **Expected:** the full chip copy is visible (wrap to 2 lines, or use a short M variant).
- **Evidence:** `probe/chip-390.png`, `probe/chip-375.png`, `probe/chip-360.png`, `probe/chip-1024.png`, `screenshots/1024x768/seq-pressure-01.png`. Also compare `artifacts/evidence/stage-b3/390x844/05-*.png`.
- **Verification test:** assert that the chip rect satisfies `right <= innerWidth - 16` and `scrollWidth <= clientWidth` at all 7 viewports.

**P01-D-009: S04 shows a black stage at exactly p = 0.65 (the morph handoff)**
- **File:** the handoff threshold in `site/src/scenes/S04Demand.tsx`, `MapStage.tsx` and `RingStage.tsx`. At 0.65 the ring-stage opacity is 0 and deck is visible but draws nothing.
- **Viewports:** 1440 and 390.
- **Repro:** `jumpTo('demand', 0.65)`. Fine sample: p 0.64 gives a 46 KB screenshot, 0.65 gives 3 KB (black), 0.66 gives 89 KB.
- **On a real scroll path,** 6px wheel steps (0.644 to 0.651), no black frame appeared, so this is limited to landing exactly on the threshold. Severity is minor.
- **Note:** the existing 1px morph-parity test runs at exactly p = 0.65 and compares projected positions only, never pixels.
- **Evidence:** `probe/demand-1440-p0.65.png`, `probe/demand-390-p0.65.png`, `screenshots/1440x900/seq-demand-02.png`, `screenshots/1920x1080/seq-demand-02.png`. Script: `scripts/fine.mjs`.
- **Verification test:** for p in 0.60 to 0.70 in 0.005 steps, assert that the stage screenshot has non-black pixel coverage above a floor.

**P01-D-010: Two Manhattan 8 AM speeds inside one scene (S05)**
- The S05 statement says "At 8 AM, Manhattan moves at 48% of its overnight speed". That is the facts.json zone-median value: 10.16 / 21.33 mph.
- The lab, defaulting to Manhattan WED 08:00, shows observed median speed 8.8 mph. That is 41% of the same 21.33 mph free-flow (the `bpr_fit` borough baseline).
- Both are correct for their own definitions, but nothing on screen reconciles them.
- **Files:** `copyS05` in `site/src/data/copy.ts`; `S05Pressure.tsx`.
- **Verification:** add a one-line note naming the two definitions, or bind the statement to the lab baseline. Add a test that the statement's % equals `obsSpeed / free_flow_mph` for the default lab state, or that the note is present.

**P01-D-011: S06 callout is stated more broadly than the data supports**
- The callout reads "Adding 15% costs more than removing 15% saves."
- It is computed citywide at WED 08:00: +1.164 against -1.126 minutes, a margin of 0.04 min (about 2 seconds).
- It is false for Manhattan (+1.00 against -1.03) and Brooklyn (+0.74 against -0.77). Over all hours of the week it holds in 141 of 168.
- **File:** the `asym` memo in `site/src/scenes/S06Futures.tsx`.
- **Expected:** scope the claim (for example "Citywide at this hour, ...") or require a minimum margin.
- **Verification:** a Vitest test that the callout text includes its scope, and that it is hidden when the margin is under a threshold.

**P01-D-012: S06 futures radiogroup ignores arrow keys and has four tab stops**
- Focusing the checked radio and pressing ArrowRight left "A BUSIER YEAR" selected. All 4 radios are separate Tab stops.
- `Segmented` elsewhere implements roving tabindex and arrows. This group should match the ARIA radio pattern.
- **File:** `.fut-select` in `S06Futures.tsx`.
- **Evidence:** `probe/probe-results.json` (`keyboard`, step "S06 futures radios"); `probe/kb-06-futures.png`.
- **Test:** focus the checked radio, press ArrowRight, and assert that aria-checked moved and focus followed.

**P01-D-013: Keyboard order during the intro**
- At 1440, with the intro playing, the first Tab focuses S02's "Card 1 of 4" tab, which scrolls the page away. Tabs 2 and 3 go to S03a radios.
- SKIP INTRO is not the first stop. The chapter nav is reached only after about 30 Tab presses through every scene (there is no skip link).
- **Files:** DOM order in `App.tsx` and `Nav.tsx` (corner button and nav rendered last).
- **Evidence:** `probe/probe-results.json` (`keyboard`, "intro tab 1..3", "first 30 tabs"); `probe/kb-01-intro-tab.png`.
- **Test:** on load, the first Tab focuses SKIP INTRO (or a "skip to chapters" link).

**P01-D-014: Duplicate live error regions**
- When facts.json fails, 6 separate `role="alert"` regions announce the same error. bpr_fit gives 3 and zone_hour_week gives 3. A screen reader hears the same failure repeatedly.
- **File:** `ErrorLine` usage across scenes (`site/src/components/StateUI.tsx`).
- **Evidence:** `probe/probe-results.json` (`errors[].alertText`).
- **Test:** block facts.json and assert exactly one `[role=alert]` per artifact in the visible scene.

**P01-D-015: The S05 error state still shows SIMULATED and DERIVED chips with no values**
- With bpr_fit failed, the SIMULATED chip and hatch stay on screen, and "DERIVED · FITTED CURVE · RMSE" has a blank value over an empty chart.
- **File:** `S05Pressure.tsx` (lab-stage head rendered while `fit` is null).
- **Evidence:** `probe/error-bpr_fit.json-1440.png`.
- **Test:** under a blocked bpr_fit, assert that no chip claims a model output.

**P01-D-016: Budgets exceeded (MOTION_SYSTEM 10)**

| Item | Measured | Budget |
|---|---|---|
| Fonts | 172 KB (Newsreader 132 KB + JetBrains Mono 40 KB) | 120 KB or less |
| Scene data | `zone_hour_week.json` alone is 496 KB gzip (2.08 MB raw) | 400 KB or less total; DR-10 asks for columnar or binary above 300 KB gzip |

- The `deckMap` chunk has no source map, so Lighthouse Best Practices fails `valid-source-maps`.
- Main JS is 105 KB gzip (budget 180) and the deck chunk is 201 KB gzip (budget 380): both pass.
- **Evidence:** §5 table.

**P01-D-017: favicon 404 makes Best Practices 0.96**
- There is no `<link rel="icon">`, so Chromium requests `/favicon.ico` at the server root and gets a 404. That console error fails `errors-in-console`.
- **File:** `site/index.html`.
- **Test:** the Lighthouse `errors-in-console` audit scores 1.

**P01-D-018: Lint fails at HEAD b2f7169**
- `eslint .` reports 2 errors (`no-empty-pattern`) in `site/e2e/motion/intro.spec.ts:4` and `site/e2e/motion/scroll.spec.ts:4`.
- These come from the other QA agent's merged suite, not product code. The Professional quality row needs lint to be clean.

**P01-D-019: e2e flake under load**
- `b2.spec.ts:227` "S05: chart labels never overlap each other or the stage header" failed on the mobile project on both attempts. `.bpr-axis` was not visible within 15s under SwiftShader, at load averages of 18 to 31.
- In my headed runs the chart rendered within 1.5s at 390 (`probe/chip-390.png`).
- **Test-reliability fix:** wait on the `bpr_fit` load state rather than a fixed 15s.

**P01-D-020: S06 on phones hides YOUR FUTURE off-screen**
- At 360 to 390 the selector is a horizontally scrolling row. "YOUR FUTURE" (and at 360 part of "A QUIETER CITY") is off-screen, with nothing to signal more options beyond a thin scrollbar.
- **Evidence:** `screenshots/390x844/seq-futures-01.png`, `screenshots/360x800/seq-futures-01.png`.

**P01-D-021: S07 at 1024x768: the top card is clipped by the viewport top edge**
- **Evidence:** `screenshots/1024x768/seq-evidence-02.png`.

### Polish

**P01-D-022: S02 card copy and spacing**
- Card 03 has an orphan wrap: "UNDER 1 MIN OR OVER 6 / H".
- In card 01 the field grid (DISTANCE_MI / DURATION_S) butts against the body copy with no gap.
- Card 02 at 1440 (p 0.4) has a large empty blue area between the title and the fleet list.
- **Evidence:** `screenshots/1440x900/seq-anatomy-02.png`, `screenshots/1920x1080/seq-anatomy-00.png`.

**P01-D-023: S03b ledger ranges wrap mid-range**
- Ranges wrap as "(P10-P90 26-" / "64)" at 1920, 1440, 1024 and 768.
- **Evidence:** `screenshots/1440x900/seq-corridors-02.png`.

**P01-D-024: OBS LAYERS button is hard to read on phones**
- On phones the LAYERS button is transparent and sits over 3D extrusions, so its label is hard to read.
- It is still the hit target: elementFromPoint returns the button, and tapping opens the sheet.
- **Evidence:** `screenshots/390x844/seq-observatory-00.png`, `probe/obs-layers-390.png`.

**P01-D-025: S07 card headers echo the reference's copy pattern**
- The headers "A SKEPTIC / NOW" and "THE PIPELINE / ALWAYS" reuse the reference's "NOW / ALWAYS" header copy pattern.
- That is a hard rejection #14 risk (copy reuse). Consider different time words.

**P01-D-026: S01 desktop shows two serif statements in one viewport**
- The shrunk hero plus "Every ride begins..." breaks the "one statement per viewport" principle.
- **Evidence:** `screenshots/1920x1080/seq-city-03.png`.

**P01-D-027: S08 at 1024x768: the footer credits overlap the Spectral rim and the echo chord**
- **Evidence:** `screenshots/1024x768/seq-closing-02.png`.

**P01-D-028: The LCP element is a span, not `h1[data-hero]`**
- The LCP element is `span.wr-word` inside `h1[data-hero]`. The MOTION_SYSTEM 11.2 assertion "LCP element selector is `h1[data-hero]`" would fail as written.
- The test should accept a descendant.

**P01-D-029: S04 labels three zones with no on-screen explanation**
- The labelled zones are ranks 1, 10 and 50 (JFK, UES North, Washington Heights South), chosen deliberately in `computeLabels`.
- The screen never says these are rank references. A viewer will wonder why LaGuardia (#2, 6.01M) is unlabelled.

### Checked and dismissed

- **The S08 echo caption is missing from the harness frames.** Dismissed: it appears 1.6s after crossing p 0.75, as designed, and was present at 2.5s and after a natural wheel scroll at 1440 and 390 (`probe/closing-*`). The harness waits only 1.1s.
- **Intro SKIP and nav visibility, EXPLORE nav hide.** My probe measured `document.querySelector("nav")`, which may match a different nav element. These readings were discarded and are not used as evidence either way.
- **"RESET ✓" not observed.** It was read at 1200ms, after the 1.2s confirmation had already ended. Not a defect.
- **Dash characters.** No U+2014 or U+2015 in `site/src`, `site/index.html`, the built JS, `docs/` or this report (Python scan).
- **External requests and reference assets.** No reference fonts, logos or JS. The e2e "no external network requests" test passed.

## 3. Review B: analytical honesty

**Spot checks.** I read the on-screen text with Playwright (`probe/probe-results.json` `numbersText`). 26 of 26 values match `facts.json` and their artifacts. I recomputed these from the raw artifacts:

| On screen | Source and independent check |
|---|---|
| 1,806 pickups, ZONE 79 East Village, SUN 1 AM | argmax of `zone_hour_week` all-services `mean_trips`: zone 79, how 145 (Sun 01), 1806.23 |
| 532 rides per minute; 280,236,580 kept | `reconciliation` sum kept / 527,040 = 531.72 |
| 281,300,386 = 280,236,580 + 1,063,806 | Recomputed: sums match exactly |
| Exclusion ledger: 0 / 584 / 23,850 / 550,106 / 486,792 / 2,474 | Per-reason sums of `reconciliation.rows[].exclusions`: match, and they add to 1,063,806 |
| 85.4% / 14.3% / 0.2% | kept by service / total: 85.432 / 14.348 / 0.220 |
| 8 AM and 6 PM peaks; weekend peak 6 PM | Weekday argmax 05-11 = 8, 15-21 = 18; Sat+Sun argmax = 18 |
| 35,115 pickups/hour at 07:00 average weekday | Recomputed 35,114.97 |
| 44,871 pickups/hr, OBS WED 08:00 citywide | Recomputed 44,870.6 |
| Half of pickups from 50 of 263 zones | Recomputed from `zone_month`: 50 |
| 79% Manhattan internal; 76% Brooklyn; 260 airport destinations | facts.json (pre-suppression interim, not re-derivable from published artifacts; provenance stated in facts.json) |
| JFK 6,247,112; UES North 3,433,535; Washington Heights South 1,870,270 | `zone_month` annual pickups: match |
| Top corridor UES South → UES North 387,897 | argmax of `od_matrix_totals` with o != d: 237 → 236, 387,897 |
| 48% Manhattan speed ratio | facts 47.65 |
| Rain +2.0% (CI +1.1% to +2.9%), "association, not cause" | `weather_model.prcp_effect_10mm` 2.000 / 1.147 / 2.860 |
| RMSE MN 0.33, QN 0.17, BX 0.18, BK 0.18, SI 0.07; holdout 0.36 / 0.59 / 1.23 | `bpr_fit` |
| Silhouette 0.33 (0.31 at k=4), random 0.01, ARI 0.89 over 10 seeds | `clusters.json` |
| S05 lab: Queens WED 08:00, x1.5 / -30%: 11.5 → 4.8 mph, 16 → 38 min, EXTRAPOLATED | Independent Python BPR recompute: 4.833 mph and 38.35 min, x1 = 1.52 > x_max 1.086 |
| S06: Queens +2.0, Bronx +1.3, Manhattan +1.0, Brooklyn +0.7, Staten Island +0.6; citywide +1.2 | Recomputed 1.98 / 1.26 / 1.00 / 0.74 / 0.64; citywide 1.164 |

**Tags.**
- OBSERVED, DERIVED and SIMULATED appear on every data visual on desktop and tablet. The phone exception is D-002.
- SIMULATED content carries all three non-colour cues: dashed strokes, hatch, and a persistent chip.
- Orange appears in observed scenes only as moving pulses (S03b, OBS). The weather chart says "association, not cause".
- No output is presented as live inference: the lab is closed-form and labelled SIMULATED.

**Honesty concerns.** See D-010 (two definitions of the Manhattan 8 AM speed) and D-011 (the callout's scope).

## 4. Review A: creative quality, and Review C: UX

**Originality.**
- This is not a template and not a dashboard. The central idea, a ring of 263 zones that becomes a dial, then a map, then a split comparison, then the closing horizon, is carried through every scene.
- Following the reference's principles comes across as homage, not copy:
  - black stages with one luminous form;
  - serif statements over uppercase mono;
  - a 4-segment story deck;
  - the argument card stack;
  - the square bottom nav and the mobile pill;
  - a closing that echoes the opening.

**Typography.** Newsreader display against JetBrains Mono UI has a clear hierarchy, and sentence-case serif is a deliberate departure from the reference. Weak spots are orphan wraps and mid-range breaks (D-022, D-023).

**Composition.**
- 1440 and 1920 are strong.
- 768 is a genuinely different composition (text above the ring, list-card ledger).
- Phones use bottom sheets and a larger mobile arc.
- 1024x768 is the weak composition: it inherits the D layout without enough height (D-001).

**Colour.** The rules hold: light-blue structure, orange only for pulses or SIMULATED, blue and purple only as fills and markers.

**Motion and scroll storytelling.**
- The contact sheets show distinct scenes, so no two consecutive scenes look alike (hard rejection #11 is satisfied).
- The weakest stretch is early S04 (p 0 to 0.4). It shows the statement over a bare arc for about two viewports, and the end of S04 and the start of S05 use the same extruded map and camera.

**Dashboard check.**
- OBS uses a floating rail and an arc scrubber, not a sidebar.
- The S05 lab chart has three hairlines and custom axis labels, but no default legend or frame. That is acceptable, though it is the closest the site comes to a standard chart panel.

**UX and keyboard.**
- **Works:** nav jumps move focus to the heading and update the hash; the S03b dial responds to arrow keys; S03a and S04 radiogroups respond to arrows; S05 sliders respond to arrows; the OBS hour slider responds to arrows (WED 08:00 to 09:00); OBS search Enter opens the inspector with focus on its title; Esc returns focus to search; EXPLORE and Esc work.
- **Defects:** D-012 and D-013.
- **Reduced motion:** no sticky elements, no blurred words, no idle ring draws (0 then 0 over 2s), and document heights of 15,583 and 15,834 px. The layout defect is D-005.

## 5. Review D: performance

**Frame pacing.** Evidence harness, headed Chromium on Mac15,6 (120 Hz display). The heavy interaction is a rapid, repeated scroll scrub from Corridors through Demand: the ring dial plus the Canvas2D-to-deck morph. stateChanged was true in every run. Load average was 27 to 55 during the pacing runs.

| Run | Samples | p50 | p95 | Frames over 16.7 ms | Frames over 33 ms |
|---|---|---|---|---|---|
| 1440x900, unthrottled | 719 | 8.3 ms | 10.4 ms | 0.14% | 0.14% |
| 1440x900, 4x CPU | 615 | 8.6 ms | 21.1 ms | 6.0% | 0.5% |
| 390x844, 4x CPU | 597 | 8.7 ms | 21.6 ms | 6.7% | 1.0% |

These meet the 60 fps desktop and 30+ fps mobile targets. Source: `artifacts/evidence/qa/frame-pacing.json`.

**Bundle** (`npm run build`; gzip -9 sizes):

| Asset | Size |
|---|---|
| Main JS | 316.8 KB raw / 105.4 KB gzip |
| deckMap (lazy) | 720.2 KB / 201.0 KB |
| CSS | 59.3 KB / 12.6 KB |
| Newsreader woff2 | 132.0 KB |
| JetBrains Mono woff2 | 40.4 KB |
| Critical data (zones_index, od_ring_top, facts, meta) | 13.9 KB gzip |
| zone_hour_week | 496 KB gzip |
| od_top | 60 KB gzip |
| zones.geojson | 97 KB gzip |
| od_matrix_totals | 118 KB gzip |

`vite preview` served everything uncompressed (zone_hour_week went out at 2.08 MB), so the deployed Pages numbers will differ.

**Lighthouse.** See the D-007 table. CLS: desktop 0.00004 and mobile 0.013 or less. a11y: 1.00 in all runs. Best Practices: 0.96 (D-016, D-017).

**Long tasks.** Lighthouse reported 2 long tasks on desktop and 2 to 3 on mobile. Main-thread work was 0.84 to 1.30 s on desktop and 2.3 to 3.0 s on mobile.

## 6. Commands run, and evidence layout

| Command | Result |
|---|---|
| `npm run build` | OK; one >500 KB warning for deckMap |
| `npx tsc --noEmit` | clean |
| `npm test` | 65/65 |
| `npm run lint` | 2 errors, in QA-merged e2e files |
| `npx playwright test e2e/shell.spec.ts e2e/scenes.spec.ts e2e/b2.spec.ts` (against 4301) | 47 passed, 1 failed, 22 skipped; load 18 to 31 |

**Evidence harness.** I used a copy of `~/data-frontier/shared/testing/evidence-harness.mjs` with project-specific scene sequences driven through `window.__atlas.jumpTo`. Output went to `artifacts/evidence/qa`, and recordings to the gitignored `artifacts/evidence/recordings/qa`. The diff and config are in `artifacts/evidence/qa/scripts/`.

The harness ran at all 7 viewports: 1920x1080, 1440x900, 1024x768, 768x1024, 390x844, 375x812 and 360x800. Each produced 36 state screenshots, a full 120-step scroll recording, and a 2 fps contact sheet. Contact sheets were downscaled to 1600px wide and quantized for commit. The full-resolution frames are in the gitignored recordings.

**Probe** (`scripts/qa-probe.mjs`):
- intro frames;
- the number readout;
- the S04 handoff sweep;
- the S08 echo;
- chip geometry;
- 8 blocked-artifact error/RETRY cases;
- axe on 10 scenes plus nav plus the whole page, in normal and reduced motion, at 1440 and 390;
- the keyboard journey;
- reduced-motion composition;
- the OBS wheel test.

Results are in `probe/probe-results.json`.

**Read by the reviewer:** all 7 contact sheets, plus about 45 full-resolution frames.
