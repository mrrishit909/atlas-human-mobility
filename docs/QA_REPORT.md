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


---

# Pass 2: re-verification after FIX-001 (task P01-QA-003)

Independent reviewer, qa-reviewer (Claude Opus 5.5). I did not build the site and I am not the pass-1 reviewer.
Date: 2026-10-11, 00:56 to about 02:00 EDT. Product code audited at HEAD a7df428 (product source identical to cf9419b).
Build: `npm run build`, served by `vite preview --port 4301 --strictPort` (the production bundle, uncompressed) in a restart loop,
because another agent killed the first preview server mid-run. The dev server was never used.
All screenshots below were taken by me in this pass. The builder's `fix-001` frames were opened only for comparison.

**Verdict: FAILED.** FIX-001 closed most of the pass-1 register. Closed: D-002 to D-013, D-015, D-017, D-018, D-020, D-021, D-025 and D-029.
D-014 is closed for duplicates, but see D-041. Lighthouse now passes clearly on a quieter machine.
The release gate still fails, on 7 open major defects:

- **D-001 (still open) and D-033 (new, root cause).** The 1024x768 and 768x1024 compositions break in any browser with
  classic (non-overlay) scrollbars, such as Windows Chrome and Edge by default, or macOS set to "always show scroll bars".
  The JS viewport class is computed from `clientWidth`, but the CSS breakpoints use the viewport width, so the two disagree.
  The FIX-001 tests run headless, where scrollbars are hidden, so they cannot see this.
- **D-030, D-031.** Honesty tags are still hidden on phones in S03a, S03b and OBS. Hard rejections #3 and #15.
- **D-035.** S02 card 3 on phones: text overprints text, including the "RAW = KEPT + EXCLUDED" check.
- **D-039.** In S04 NET mode the direct labels overprint each other's numbers at all 7 viewports.
- **D-041.** When facts.json fails, CITY shows no error and no RETRY. The cards just vanish.

Several of these (D-030, D-031, D-035) were already present in the pass-1 frames and were missed then. They are recorded as
new here, with the pass-1 frame cited.

Machine: Mac15,6 (Apple silicon, 120 Hz). Other agents ran during the whole session. The load average is recorded next to
every performance number.

## P2.1 Release gate (pass 2)

| Row | Result | Measured evidence |
|---|---|---|
| Visual design | PASS (with defects) | Art-directed, not a template. All 7 contact sheets show a distinct composition per scene: ring, dial, extruded map, lab chart, split ring, card stack, observatory, Spectral horizon. The layout defects are logged under Responsiveness. |
| Motion UI (6 layers) | PASS | Intro blur reveal and ring (contact sheets, first frames). Nav: 30 jumps at 1440/1024/390 all land fully resolved, 0 ghost words (`probe/probe-results.json` `nav`). Scroll storytelling: scrubbed ring, dial steps, map morph. Component motion: dial, lab tweens. Data transitions: HEIGHT, futures. Microinteractions: pulses, RESET. |
| UX | **FAIL** | Keyboard journey works: SKIP INTRO is the first Tab, SKIP TO CHAPTERS the second, and Enter lands on the CITY nav link. Dial arrows work. S06 has one tab stop with arrows. The lab slider changes the result, and YOUR FUTURE then enables. OBS search, then Enter, opens the inspector, and Esc returns focus. Open: D-041 (facts error not shown where the data is missing), D-033 (tablet and compact-desktop layouts break with classic scrollbars). |
| Functionality and states | **FAIL** (one major) | I blocked each artifact and checked the error line and RETRY: zones_index, zone_hour_week, od_top, zones.geojson (1440, 390), bpr_fit (S05 and S06, 1440 and 390), weather_model and clusters. Each shows one alert, and RETRY re-fetches once and recovers (hits 1 to 2, alerts after: none). No model chip appears without a model (D-015 closed). Open: D-041 (facts.json: the only alert is in #anatomy, so CITY is silent), D-042 (od_ring_top fails silently). |
| AI / analytical honesty | **FAIL** | 27 on-screen numbers recomputed from the raw artifacts all match (§P2.4). The S05 speeds are reconciled on screen (D-010 closed). The S06 callout is scoped and thresholded (D-011 closed). But hard rejections #15 and #3 still fail on phones: the S03a ring has no tag (D-030), and orange pulses are drawn in S03b and OBS with the DERIVED sampling chip `display:none` (D-031). |
| Performance | **PASS** | Lighthouse, 3 runs each at load 6.4 to 7.6. Desktop: perf 1.00/1.00/1.00, LCP 404/404/406 ms. Mobile: perf 0.99/0.99/0.99, LCP 1804/1806/1806 ms. CLS 0 everywhere. TBT 0 to 5 ms. a11y 0.99. BP 1.00. Frame pacing (§P2.5): desktop p95 10.7 ms; 390x844 at 4x CPU p95 28.3 ms (about 35 fps). Remaining budget item: D-016 (data). |
| Responsiveness (3 compositions plus 7 viewports) | **FAIL** | D, T and M are distinct compositions (contact sheets). Tickets: 0 defects in 84 states. S04 labels are inside the viewport on phones. S05 chips fit at all 7 viewports. Reduced motion has no sideways scroll at any of the 7 viewports. Open: D-001/D-033 (1024 and 768 with classic scrollbars), D-035 (S02 card 3 on phones), D-039 (S04 NET labels). |
| Professional quality | PASS (with a test-reliability note) | `tsc --noEmit`: clean. `eslint .`: clean (D-018 closed). Vitest: 70/70. e2e run 2: 73 passed, 47 skipped (fix001 skips the mobile project by design), 0 failed, 0 flaky, at load 16 to 24. QA motion suite: 21 passed, 17 skipped at load 5.5 (run 1: 1 timeout at load 16 to 22, D-044). axe: 80 scans, 0 serious or critical; 1 moderate `skip-link` on every page (D-038). All 8 required docs present. |
| GitHub | BLOCKED | Out of scope for this task. No remote yet. |
| Deployment | BLOCKED | Out of scope for this task (not deployed). Performance must be re-measured on the gzip-serving Pages URL. |
| Portfolio | BLOCKED | Out of scope for this task. |

## P2.2 Previous register re-verified (pass-1 ids kept)

All paths are under `artifacts/evidence/qa-2/` unless marked otherwise.

| Id | Status | Evidence (fresh, this pass) | Notes |
|---|---|---|---|
| D-001 1024x768 collisions | **OPEN (major)** | `probe/geom-1024x768-rush-hour-0.35.png`, `-rush-hour-0.65.png`, `-futures-0.35.png`, `-corridors-0.35.png`, `-demand-0.9.png`; `probe/headed-1024-futures-fresh-0.35.png` (fresh load, same breakage); `probe/headless-1024-rush-0.35.png` (clean, no scrollbar) | Closed only when the browser has overlay scrollbars. With a classic scrollbar (clientWidth 1009): the S03a ring crosses the statement, body, controls and chip; the S06 hatched bars overprint the borough names and minutes; the S03b arc and anchor square cross ledger rows; the S04 map runs into the "LABELS..." body copy. Root cause in D-033. S01 at 1024 is clean (`geom-1024x768-city-0.9.png`). |
| D-002 S01 tags on phones | CLOSED | `probe/tags-390x844-city-0.78.png`, `tags-360x800-city-0.78.png`; `probe-results.json` `tags` (OBSERVED and DERIVED visible on both cards at 390/375/360) | The same failure persists in other scenes: see D-030, D-031, D-032. |
| D-003 tickets | CLOSED | `probe-results.json` `tickets`: 84 states (7 progress points x 4 bands x 1920/1440/1024/768, 62 with tickets), 0 overlaps under 8 px, 0 outside 16 px, 0 clipped text; `probe/tickets-1440x900-0.3-ALL.png`, `tickets-1920x1080-0.55-ALL.png`, `tickets-1024x768-0.3-ALL.png` | Holds with a classic scrollbar too. |
| D-004 S04 labels on phones | CLOSED (PICKUPS, DROPOFFS) | `probe/labels-390x844-PICKUPS.png`, `labels-360x800-PICKUPS.png`; `probe-results.json` `labels` | NET mode has a new collision, logged as D-039. |
| D-005 reduced-motion overflow and leaks | CLOSED | `probe-results.json` `rm`: at all 7 viewports maxScrollWidth = clientWidth (scanned every 400 px), 0 S04 labels leaked, 0 sticky, 0 blurred words; `probe/rm-1440x900-pressure.png`, `rm-390x844-pressure.png` | |
| D-006 nav landings | CLOSED | `probe-results.json` `nav`: 30 real nav clicks (desktop bar at 1440/1024, MENU pill at 390), 0 half-revealed words, 0 serious or critical axe after any jump; `probe/nav-1440x900-city.png`, `nav-390x844-city.png`, `nav-1024x768-demand.png` | |
| D-007 mobile LCP | CLOSED | `lighthouse-run{1,2,3}/mobile.report.json`: LCP 1804/1806/1806 ms, perf 0.99 x3 | The display face is now a 34 KB latin subset. |
| D-008 S05 chip overflow | CLOSED | `probe-results.json` `chip`: at all 7 viewports, chip right edge at or under W-16 and scrollWidth at or under clientWidth; `probe/chip-390x844-0.5.png`, `chip-360x800-0.5.png`, `chip-1024x768-0.5.png` | |
| D-009 S04 black frame at p 0.65 | CLOSED | `fix001.spec.ts` D-009 passed in my e2e run 2 (21 frames from 0.60 to 0.70 at 1440 and 390) | |
| D-010 two Manhattan speeds | CLOSED | `probe/s05-1440-0.1.png`; the text reads "48% IS THE MEDIAN ZONE SPEED ... THE LAB POOLS ALL MANHATTAN TRIPS: 8.8 MPH AT WED 08:00, 41% OF 21.3 MPH" | I recomputed 8.8, 41% and 21.3 from `bpr_fit` (§P2.4). |
| D-011 S06 callout scope | CLOSED | `probe/s06-1440-0.5.png`. The callout is now "Citywide at {hour}, ..." and needs a 0.25 min margin. | My recompute: the largest margin over all 168 hours is 0.054 min, so the callout never renders. The over-broad claim is gone; the dead UI is logged as D-043. |
| D-012 S06 radios | CLOSED | `probe-results.json` `keyboard`: 1 tab stop out of 4 radios. ArrowRight steps BUSIER, then LANE LOST, then QUIETER, then wraps (skipping the disabled YOUR FUTURE). Focus follows. `probe/kb-03-futures.png` | |
| D-013 intro keyboard order | CLOSED | `probe-results.json` `keyboard` and `scripts/skip.mjs`: Tab 1 is SKIP INTRO, Tab 2 is SKIP TO CHAPTERS, Enter lands on the CITY nav link, and Enter on ANATOMY focuses its h2 | The skip link's href has no target (D-038). |
| D-014 duplicate live regions | CLOSED (duplicates) | `probe-results.json` `errors`: exactly 1 alert per failed file in every case | The single alert for facts.json is placed off-scene (D-041). |
| D-015 model chips in error state | CLOSED | `errors`: 0 SIMULATED/DERIVED lab chips with bpr_fit blocked, at 1440 and 390; `probe/error-bpr_fit.json-pressure-1440.png` | |
| D-016 budgets | **OPEN (minor)** | `dist/` gzip -9: zone_hour_week.json 496,397 B (budget 400 KB total scene data); deckMap still ships without a source map (Lighthouse `valid-source-maps` 0, unweighted; BP 1.00) | Fonts are now 34 KB + 5 KB (pass). |
| D-017 favicon | CLOSED | `curl` favicon.svg 200; Lighthouse BP 1.00 in all 6 runs | |
| D-018 lint | CLOSED | `npm run lint`: clean | |
| D-019 e2e flake under load | Not reproduced | e2e run 2: 0 flaky | Other tests flaked under load (D-044). |
| D-020 S06 YOUR FUTURE off-screen on phones | CLOSED | `probe/tags-390x844-futures-0.5.png` (the selector is a 2x2 grid, all four visible) | |
| D-021 S07 top card clipped at 1024 | CLOSED | `probe/geom-1024x768-evidence-0.35.png` | |
| D-022 S02 card copy and spacing | OPEN (polish) | Geometry: the DISTANCE_MI / DURATION_S grid overlaps the body by 5 px at every desktop viewport; `probe/geom-1024x768-anatomy-0.35.png` | |
| D-023 ledger ranges wrap mid-range | OPEN (polish) | `probe/geom-1440x900-corridors-0.65.png` ("(P10-P90 5-" / "13)") | |
| D-024 OBS LAYERS button on phones | OPEN (polish) | `probe/tags-390x844-observatory-0.png` | |
| D-025 S07 NOW/ALWAYS headers | CLOSED | `probe/geom-1024x768-evidence-0.35.png` (now "FROM A READER" / "SOURCE: ...") | |
| D-026 S01 two statements | Not re-verified | | |
| D-027 S08 footer over the rim at 1024 | OPEN (polish) | `probe/geom-1024x768-closing-0.9.png` | Also on phones: `screenshots/360x800/seq-scroll-closing-03.png`. |
| D-028 LCP selector test | Not applicable | | Lighthouse did not report an LCP element node in this version. |
| D-029 S04 rank labels unexplained | CLOSED | "LABELS: THE ZONES RANKED 1, 10 AND 50 BY THIS HEIGHT" (`probe/geom-1440x900-demand-0.9.png`) | |

## P2.3 New defects

### Major

**P01-D-033: The JS viewport class disagrees with the CSS breakpoints when the browser has classic scrollbars** (major, responsiveness; root cause of the still-open D-001)
- **Files:**
  - `site/src/graphics/canvas.ts:21`: `stageW = () => document.documentElement.clientWidth`.
  - `site/src/graphics/ring.ts:10,28`: `viewportClass` and `isCompact` are computed from it.
  - CSS media queries in `site/src/styles/scenes.css` use the viewport width, which includes the scrollbar.
- **Viewports and conditions:**
  - At 1024x768 (clientWidth 1009) JS picks "T" while CSS lays out compact D.
  - At 768x1024 (clientWidth 753) JS picks "M" while CSS lays out T.
  - This applies to any browser with a classic scrollbar: Windows Chrome and Edge by default, or macOS with "always show scroll bars". Headed Playwright Chromium on this Mac shows it too.
- **Repro:** run headed Chromium at 1024x768, then `__atlas.jumpTo('rush-hour', 0.35)` and `jumpTo('futures', 0.35)`.
- **Expected:** every scene uses the composition its CSS selects, and no text collides with text, the ring or the bars.
- **Actual at 1024:**
  - S03a: the ring is drawn with T geometry and centred, crossing the statement, body, controls and the OBSERVED chip.
  - S06: the minutes list uses T row heights (22 px) inside the D layout, so the hatched bars overprint "BRONX ... +1.3 MIN" and the other rows. The ring shrinks to a small split.
  - S03b: the arc and anchor square cross the ledger rows.
  - S04: the map runs into "LABELS: THE ZONES RANKED ... BY THIS HEIGHT".
- **Actual at 768:**
  - S03a: the ring crosses the controls and the chip row.
  - S06: the delta bars shrink to 1 px ticks at the far right.
  - S04 clusters: the cluster labels overprint the DERIVED chip and the "K-MEANS, K=3, SILHOUETTE 0.33" caveat.
- **Evidence:**
  - `probe/geom-1024x768-rush-hour-0.35.png`, `geom-1024x768-futures-0.35.png`, `geom-1024x768-corridors-0.35.png`, `geom-1024x768-demand-0.9.png`
  - `probe/geom-768x1024-rush-hour-0.35.png`, `geom-768x1024-futures-0.35.png`
  - `screenshots/768x1024/seq-scroll-demand-03.png`
  - Control: `probe/headless-1024-rush-0.35.png` (no scrollbar, clean)
  - The 1024 and 768 contact sheets.
- **Verification test:**
  - Run the D-001 bbox specs with a visible scrollbar: launch with `ignoreDefaultArgs: ['--hide-scrollbars']` or headed, or inject `::-webkit-scrollbar { width: 15px }`.
  - Add a unit assertion that `viewportClass(stageW())` equals the class implied by `matchMedia('(min-width: 1024px)')` and `matchMedia('(min-width: 768px)')`.

**P01-D-030: S03a has no honesty tag on phones** (major, honesty, hard rejection #15)
- **File:** `site/src/styles/scenes.css:113` (`.rush-text .scene-body, .rush-tags { display: none; }` at max-width 767px).
- **Viewports:** 390x844, 375x812 and 360x800.
- **Repro:** jump to rush-hour at 0.35 (and at any p).
- **Expected:** the OBSERVED · MEAN TRIPS PER HOUR chip is visible with the ring.
- **Actual:** the chip has a 0x0 box. The data ring and the "35,115 PICKUPS / HOUR" readout show with no tag.
- **History:** the same state is in pass-1 `artifacts/evidence/qa/screenshots/390x844/seq-rush-hour-01.png`. Pass 1 missed it, and the FIX-001 D-002 test checks only `.city-cards`.
- **Evidence:** `probe/tags-390x844-rush-hour-0.35.png`, `tags-375x812-rush-hour-0.35.png`, `tags-360x800-rush-hour-0.35.png`; `probe-results.json` `tags`.
- **Verification test:** at 390/375/360, for every scene landing, assert that each data visual has a visible `.chip` (non-zero box, in the viewport).

**P01-D-031: Orange pulses are drawn on phones without their DERIVED sampling label in view (S03b, OBS)** (major, honesty, hard rejection #3)
- **Files:** `scenes.css:158` (`.cor-text .cor-chips .chip:nth-child(n + 2) { display: none; }`) and `scenes.css:468` (`.obs-title .cor-chips .chip:nth-child(n + 2)`), both at max-width 767px.
- **Viewports:** 390x844, 375x812 and 360x800.
- **Repro:** jump to corridors at 0.3, or to observatory.
- **Expected:** "DERIVED · PULSES SAMPLED FROM ZONE-TO-ZONE COUNTS, SEEDED" (S03b) and "DERIVED · FLOWS ... SEEDED TIMING" (OBS) are in view whenever pulses move.
- **Actual:** only the OBSERVED chip is shown, while orange pulses travel the chords (S03b) and the 3D map (OBS).
- **Evidence:** `probe/tags-390x844-corridors-0.3.png`, `probe/tags-390x844-observatory-0.png`; `probe-results.json` `tags` (`hiddenChips`).
- **Verification test:** on phones, while `.cor-hit` or the OBS flows are on, assert that a visible chip contains "PULSES" or "FLOWS".

**P01-D-035: S02 card 3 on phones: the title overprints the ledger, and the reconciliation check overprints the body** (major, responsiveness)
- **File:** the card 3 layout in `S02Anatomy.tsx` and `.a-ledger` at M.
- **Viewports:** 390x844, 375x812 and 360x800.
- **Repro:** jump to anatomy at 0.5 (card 3 centred).
- **Expected:** title, ledger, check line and body each sit in their own space.
- **Actual:**
  - "1,063,806 rows didn't make it." is drawn over "MISSING TIMESTAMP 0".
  - "RAW = KEPT + EXCLUDED ✓", the card's proof line, is drawn over "TIMESTAMPS OUTSIDE THEIR MONTH...", so both are illegible.
- **History:** present in pass-1 `qa/screenshots/390x844/seq-anatomy-02.png` and missed then.
- **Evidence:** `probe/anat3-390-0.5.png`, `probe/geom-390x844-anatomy-0.65.png`; `probe-results.json` `geom` (390/375/360, overlaps of 131x13 px and 177x16 px).
- **Verification test:** at the phone widths with card 3 centred, assert that the tight text boxes of the title, ledger rows, `.a-ledger__check` and body do not intersect.

**P01-D-039: S04 NET mode: the direct labels overprint each other's numbers** (major, data legibility; same class as D-004)
- **File:** `computeLabels` and `.dem-label` placement in `S04Demand.tsx`. There is no collision pass between labels.
- **Viewports:** all 7. At 360 a third label also overlaps.
- **Repro:** jump to demand at 0.89, then click NET.
- **Expected:** labels never overlap, and each number is fully legible.
- **Actual:**
  - "UNION SQ · 439,627" is overprinted by "STEINWAY · 91,757"; on screen it reads "UNION SQ · 439,6?".
  - At 360, "NEWARK AIRPORT · 1,802,804" also overlaps STEINWAY.
- **Evidence:** `probe/labels-1440x900-NET.png`, `probe/labels-390x844-NET.png`; `probe-results.json` `labels` (`bad`).
- **Verification test:** for each metric at the 7 viewports, assert that the `.dem-label` rects are pairwise disjoint.

**P01-D-041: facts.json failure: CITY shows no error state** (major, functionality and states)
- **File:** the D-014 change placed the single `FactsState` alert in `#anatomy` (`FactsState.tsx` and its call sites).
- **Viewports:** 1440x900 and 390x844.
- **Repro:** block `**/data/facts.json` and land on CITY at 0.78.
- **Expected:** where the facts-bound cards and statements are missing, the visitor sees "COULD NOT LOAD FACTS.JSON" and RETRY.
- **Actual:**
  - The two S01 cards vanish silently.
  - The only alert is `section#anatomy`, off-screen (`inView: false`).
  - The other facts-driven statements (S03b, S04, S05, S08) also lose their text with no message in their own scene.
- **Evidence:** `probe/error-facts.json-city-1440.png`, `probe/err2-facts.json-city.png`; `scripts/err2.mjs` output: `[{"section":"anatomy","inView":false}]`.
- **Verification test:** block facts.json, land on CITY, and assert that an in-viewport `[role=alert]` names FACTS.JSON with a RETRY that recovers. Keep one live region by making only the visible scene's line `role=alert`.

### Minor

- **P01-D-032: S06 on phones: the OBSERVED · LEFT HALF chip is hidden.**
  - File: `scenes.css:323`.
  - On the rotated split, the observed half has no tag. "LEFT HALF" would also be the wrong word there, because that half is on top.
  - Evidence: `probe/tags-390x844-futures-0.5.png`.
  - Test: a visible OBSERVED chip worded for the M orientation.
- **P01-D-034: S07 answer 05 on phones: the holdout triplets wrap one number per line** ("0.18 / 0.31 / 0.63" stacks vertically).
  - Evidence: `probe/geom-360x800-evidence-0.65.png`, `screenshots/390x844/seq-scroll-evidence-02.png`.
- **P01-D-036: S03b at 1440: the arc crosses the DERIVED chip and the 5th ledger row.**
  - The ring-versus-text assertion runs only at 1024, so 1440 is not tested.
  - Evidence: `probe/geom-1440x900-corridors-0.65.png` (Brooklyn: nodes inside the chip box, arc through "175,162 ... 6-18)").
- **P01-D-038: SKIP TO CHAPTERS has `href="#chapters"`, but no element has that id.**
  - Lighthouse `skip-link` fails, so a11y is 0.99. axe reports a moderate `skip-link` on every scan.
  - With JS the onClick moves focus correctly (D-013).
  - File: `site/src/app/App.tsx:65`.
- **P01-D-042: od_ring_top.json failure is silent.** The S01 chords never appear, and there is no alert or RETRY.
  - Evidence: `probe/err2-od_ring_top.json-city.png`.
- **P01-D-044: Test reliability under load.**
  - e2e run 1 (load 21 to 24): `b2.spec.ts:95` (OBS inspector) and `b2.spec.ts:158` (deck render loop) failed their first attempts before an outside agent killed the preview server.
  - QA motion run 1 (load 16 to 22): `motion/scroll.spec.ts:8` timed out in `page.evaluate`.
  - Clean reruns: e2e run 2 had 0 flaky; QA motion run 2 had 21 of 21 passed.
- **P01-D-045: One console error under reduced motion at 375x812:** `@math.gl/web-mercator: assertion failed.` (`probe-results.json` `rm[5].errors`). Seen once and not investigated further.

### Polish

- **P01-D-037: S04 direct labels over white extrusions are low contrast** (JFK at 1440). Evidence: `probe/geom-1440x900-demand-0.9.png`.
- **P01-D-040: Under reduced motion, the fixed corner wordmark and code are overprinted by the hero as it scrolls under them** (1024, 768). Evidence: `probe/rm-1024x768-city.png`.
- **P01-D-043: The S06 asymmetry callout is dead UI.** Its 0.25 min threshold is never met: the largest margin over all 168 hours is 0.054 min (my recompute of `boroughDeltas` from `bpr_fit.json`). Remove it, or document why it is kept.
- **P01-D-046: S03b on phones: the band selector row clips EVENING** at the right edge (349..407 px against 390), with no scroll affordance. Evidence: `probe/tags-390x844-corridors-0.3.png`.

## P2.4 Review B: analytical honesty

I recomputed 27 on-screen values independently in Python from `site/public/data/*`. The on-screen text was read with
Playwright (`probe-results.json` `numbersText`). All 27 match:

| On screen | Independent recompute |
|---|---|
| ZONE 79 East Village, SUN 1 AM, 1,806 pickups | argmax of `zone_hour_week` all: (1806.23, zone 79, how 145) |
| 532 rides per minute; 280,236,580 in all | `reconciliation` kept sum 280,236,580 / 527,040 = 531.72 |
| 281,300,386 = 280,236,580 + 1,063,806 | raw and excluded sums match |
| Exclusions: 0 / 584 / 23,850 / 550,106 / 486,792 / 2,474 | per-reason sums: null_timestamp 0, ts_out_of_month 584, nonpositive_duration 23,850, bad_duration 550,106, bad_distance 486,792, implausible_speed 2,474 |
| APP 85.4% / YELLOW 14.3% / GREEN 0.2% | kept by service / total |
| 07:00 35,115; 20:00 41,387; 18:00 46,542 (S03a table); "8 AM ... 6 PM" | Mon to Fri mean of hour-of-week sums: 35,115 / 41,387 / 46,542; AM argmax 8, PM argmax 18 |
| OBS WED 08:00 citywide 44,871 pickups/hr | 44,870.6 |
| UES South → UES North 387,897 (S03b, S08) | `od_matrix_totals` argmax with o != d: (237 → 236) 387,897 |
| LaGuardia → Times Sq 294,588; JFK → Times Sq 201,992; Bushwick S → N 223,413; Williamsburg S → N 154,657 | `od_matrix_totals` pairs, exact |
| JFK 6,247,112; LaGuardia 6,012,946; Midtown Center 4,691,448; rank 10 UES North 3,433,535; rank 50 Washington Heights South 1,870,270 | `zone_month` annual pickups, ranked |
| Half of pickups from 50 of 263 zones | cumulative share reaches 50% at 50 zones |
| 48% Manhattan; the lab's 8.8 mph = 41% of 21.3 mph | facts 47.65; `bpr_fit` Manhattan baseline[56] 8.80 mph / free-flow 21.325 |
| RMSE 0.33 (MN) | `bpr_fit` 0.328 |
| S06 observed minutes 15.4 / 16.4 / 16.1 / 15.0 / 11.7 | `bpr_fit` baseline[56] median_trip_min |
| S06 +2.0 / +1.3 / +1.0 / +0.7 / +0.6, citywide +1.2 | BPR recompute: city +1.164 |
| "14 zones without trips at this hour excluded" | `zone_hour_week.speed_ratio` null at how 56: 14 |
| 79% Manhattan internal | post-suppression recompute 79.0 (facts 79.02) |
| Rain +2.0% | `weather_model.prcp_effect_10mm` 2.000 (CI 1.15 to 2.86), shown with "WE CAN'T SAY 'CAUSE'" |

**Tags and simulation.**
- Desktop and tablet carry OBSERVED, DERIVED and SIMULATED on every data visual.
- SIMULATED keeps its dashes, hatch and persistent chip on phones too (`probe/geom-390x844-pressure-0.65.png`).
- No output is presented as live inference. The lab is closed-form and labelled SIMULATED, and the S06 note reads "NOT A FORECAST".
- The phone tag failures are D-030, D-031 and D-032.

## P2.5 Review A (creative), C (UX), D (performance)

**A. Creative quality.** I read all 7 contact sheets (`contact-sheets/*.png`: committed copies are 1600 px wide and
quantized; full-size copies are in the gitignored `recordings/qa-2/contact-sheets-full/`). I also read about 45
full-resolution frames from this pass: the probe frames cited above, plus `screenshots/*/scene-*.png`,
`screenshots/1920x1080/seq-s03b-dial-keyboard-02.png` and `screenshots/390x844/seq-s04-height-02.png`.

- It does not look like a dashboard: OBS uses a floating rail and the horizon scrubber.
- No two consecutive scenes match. Ring, dial, extruded map, lab chart, split ring, card stack, observatory and Spectral horizon each have their own composition at every width.
- The closing echoes the opening ring.
- The weakest compositions are the defects above, and they are concentrated at 1024 and 768 (D-033).

**C. UX.** Keyboard: see D-012, D-013 and `probe-results.json` `keyboard`.

- **Reduced motion:** `data-motion=off`, 0 sticky stages, 0 blurred words, no horizontal overflow at any of the 7 viewports.
- **Mobile:** the MENU pill jumps work, and the bottom sheets and S06 2x2 selector are usable. Defects: D-030, D-031, D-035, D-046.
- **Error states:** see the Functionality row and D-041.

**D. Performance.**

| Lighthouse (`run-lighthouse.sh`, `vite preview`, uncompressed) | perf | a11y | BP | LCP ms | CLS | TBT ms | load avg before / after |
|---|---|---|---|---|---|---|---|
| run 1 desktop / mobile | 1.00 / 0.99 | 0.99 / 0.99 | 1.00 / 1.00 | 404 / 1804 | 0 / 0 | 0 / 0 | 7.59 / 6.43 |
| run 2 desktop / mobile | 1.00 / 0.99 | 0.99 / 0.99 | 1.00 / 1.00 | 404 / 1806 | 0 / 0 | 0 / 5 | 6.43 / 7.01 |
| run 3 desktop / mobile | 1.00 / 0.99 | 0.99 / 0.99 | 1.00 / 1.00 | 406 / 1806 | 0 / 0 | 0 / 2 | 7.01 / 7.38 |

Reports: `lighthouse-run{1,2,3}/{desktop,mobile}.report.{json,html}`. a11y is 0.99 because of D-038.

| Frame pacing (harness, headed Chromium, Mac15,6; rapid jumpTo storm every 120 ms; load 4.9 to 7.5) | samples | p50 | p95 | over 16.7 ms | over 33 ms |
|---|---|---|---|---|---|
| 1440x900 unthrottled | 476 | 8.3 ms | 10.7 ms | 0.4% | 0.2% |
| 1440x900, 4x CPU | 262 | 10.4 ms | 36.6 ms | 25.2% | 6.9% |
| 390x844, 4x CPU | 337 | 9.1 ms | 28.3 ms | 14.8% | 3.3% |

These meet the targets: about 60 fps on desktop (p95 10.7 ms) and 30 fps or more on emulated mobile (p95 28.3 ms, about 35 fps).
The 4x-throttled desktop run is shown for information. Source: `frame-pacing.json`.

Bundle (`npm run build`): main JS 320.6 KB raw / 108.3 KB gzip; deckMap 720.2 / 203.4 KB; CSS 61.2 / 13.0 KB;
fonts 34.3 + 4.9 KB.

## P2.6 Commands run

| Command | Result (load average) |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 9 files, 70/70 passed |
| `npm run build` | OK (deckMap over 500 KB warning) |
| `npx playwright test` run 1 | aborted: an outside agent killed the 4301 preview mid-run. Before that, b2:95 and b2:158 failed their first attempts (load 21 to 24) |
| `npx playwright test` run 2 (restart-loop server) | 73 passed, 47 skipped, 0 failed, 0 flaky, 4.6 min (load 16 to 24); log `scripts/e2e-run2.log` |
| `npx playwright test -c playwright.qa.config.ts` run 1 | 20 passed, 1 failed (scroll.spec:8 timeout), 17 skipped (load 16 to 22); log `scripts/qa-motion-run1.log` |
| `npx playwright test -c playwright.qa.config.ts` run 2 | 21 passed, 17 skipped (load 5.5 to 9.5) |
| `run-lighthouse.sh` x3 | see §P2.5 |
| Evidence harness (QA copy writing to `qa-2`, diff in `scripts/evidence-harness.qa2.diff`) | 7 viewports, 76 states each, scroll recordings plus contact sheets, frame pacing |
| `scripts/probe2.mjs` parts geom, tags, tickets, labels, rm, nav, axe, chip, s05s06, keyboard, errors, numbers | `probe/probe-results.json` |

**Evidence layout.**
- Committed (about 15 MB): `artifacts/evidence/qa-2/`, holding the cited probe frames, `screenshots/*/scene-*.png` plus 5 cited sequence frames, the contact sheets, Lighthouse, frame pacing and scripts.
- Gitignored: everything else (259 geom frames, all 532 harness states, webm recordings, 1 fps frames and full-size sheets) is in `artifacts/evidence/recordings/qa-2/`.
- Some `file` entries in `probe-results.json` point to frames that were moved there (`probe-all/`).
