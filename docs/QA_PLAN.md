# P01 QA plan (independent QA, branch qa/motion-tests)

Baseline: main e8d1f40 (S01-S08 + OBS built). Production build only (`vite preview`, port 4302).

## How to run

- Motion/robustness suite: `cd site && npx playwright test -c playwright.qa.config.ts` (workers 1, builds, serves on 4302; `desktop` + `mobile` projects, most tests are desktop-only and set their own viewports).
- Evidence: serve a production build, then `node tests/evidence-harness.mjs --base-url http://localhost:4302/atlas-human-mobility/ [--skip-pacing]`. Output lands in `artifacts/evidence/{screenshots,recordings,contact-sheets}`. Needs headed Chromium and `ffmpeg-static` (`npm i --no-save ffmpeg-static`; it is not in package.json). The first prep run is in `artifacts/evidence/qa-prep/`.
- Lighthouse: `bash tests/run-lighthouse.sh <url> artifacts/evidence/lighthouse`.
- Harness config: `tests/evidence.config.json` = 10 section anchors, 4-point jumpTo scroll sequence per scene, S03a day/service sequence, S03b dial keyboard sequence, S04 HEIGHT metric sequence, nav-jump sequence, heavy-interaction jump storm.

## Test map (site/e2e/motion)

| # | Requirement | Spec |
|---|---|---|
| 1 | Stage releases at track end, no trap (wheel at p=1 of every track) | scroll.spec.ts 1 |
| 2 | Reverse scroll, wheel/scrollTo storms, nav==in-view, finite state | scroll.spec.ts 2a/2b/2c |
| 3 | Nav jumps (bar and pill), Back/Forward, deep links | nav.spec.ts 3a/3b/3c |
| 4 | Resize 1440 to 390 and back, section kept, no x-overflow | nav.spec.ts 4 |
| 5 | Reduced motion: nav + keyboard reach, no sticky, text per section, canvases hidden/labelled | robust.spec.ts 5 |
| 6 | Story cards inside viewport and clear of MENU pill at 360/375/390 (sampled on card plateaus) | robust.spec.ts 6 |
| 7 | Intro SKIP, Esc, no replay in session, REPLAY INTRO | intro.spec.ts 7a-7d |
| 8 | Visible focus ring: nav, utilities, S03a/S03b/S04/S02/S05 controls, mobile pill | focus.spec.ts 8a-8c |

Existing e2e (not duplicated): b2.spec reverse/rapid through S05-S08, shell.spec basic nav/resize/axe.

## Results (run 2, production preview)

21 passed, 17 skipped (project-gated), 0 failed. Run 1 had 6 failures that were all test-side (Lenis revert, intro listener race, display:none button, sampling cards mid-slide); fixed, no product defect hidden by that. No timeouts observed.

## Early findings

Evidence read: contact sheets 1440x900 and 390x844, plus S04 height, mobile anatomy and futures stills. Contact sheets are 1fps at 240px, good for flow only; detail was checked on stills. Other viewports (1920, 1024, 768, 375, 360) were captured but not yet reviewed.

| ID | Sev | File | Repro | Expected | Actual |
|---|---|---|---|---|---|
| QA-001 | Medium | src/components/StoryCard.tsx + src/scenes/S02Anatomy.tsx (card 3 ledger visual) | 390x844, jumpTo anatomy 0.65 (`qa-prep/screenshots/390x844/seq-scroll-anatomy-02.png`) | Title and ledger rows never overlap | Card "WHAT WE REMOVED": title "806 rows make it." is overprinted by the ledger rows (TIMESTAMP 0, 584, ...); body text also collides below. Card is mid-slide in that frame, but the overlap is within the card. Re-check on plateau (p 0.55) at 360/375/390 |
| QA-002 | Low | src/scenes/S06Futures.tsx scenario tabs | 390x844, jumpTo futures 0.65 (`seq-scroll-futures-02.png`) | Three scenario tabs fit or scroll without chrome | Tabs overflow with a visible horizontal scrollbar, "A QUIET CITY" truncated at the right edge, tab strip touches the readout card |
| QA-003 | Low | src/scroll/engine.ts (Lenis) | After any wheel input, first `window.scrollTo(0, y)` far away snaps back to the old position (4300 instead of 10800); a second call works. Native focus scroll was fine | Programmatic scroll is honoured | Lenis reverts the first native scroll. Affects find-in-page/assistive scroll possibly; not reproduced for focus or anchors. Tests use `__atlas.jumpTo` to avoid it |
| QA-004 | Info, verify | src/scenes/S04Demand.tsx | 1440x900, jumpTo demand 0.7 (`seq-s04-height-02.png`) | Pitched, extruded map by this progress (VISUAL_DESIGN S04) | Map reads flat top-down; software WebGL (SwiftShader) may suppress extrusion or camera not yet eased after an instant jump. Confirm on real GPU before calling it a defect |
| QA-005 | Tooling | ~/data-frontier/shared/testing/evidence-harness.mjs | Recording over about 60s | Contact sheet built | Full-size tile fails "Picture size invalid". Fixed in site/tests copy only (1fps, 240px tall) |

Not yet covered: frame pacing and Lighthouse (skipped this run), S05-S08 detailed visual review, 768/1024 compositions, interaction recordings review.
