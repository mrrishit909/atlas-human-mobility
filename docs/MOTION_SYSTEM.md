# Motion system: Atlas of Human Mobility

This is the phase 17 motion bible. It pairs with `VISUAL_DESIGN.md`: scene ids S00-S08 and OBS, the ring states R0/R0c/R1/R2/R3, and interaction numbers 1-10 all refer to that document. Every value here is binding for the frontend engineer. A deviation needs a written reason in `docs/ENGINEERING_DECISIONS.md`.

## Contents

1. [Global principles](#1-global-principles)
2. [Hard rules](#2-hard-rules)
3. [Token mapping](#3-token-mapping)
4. [The scroll engine](#4-the-scroll-engine)
5. [Animation specifications](#5-animation-specifications)
6. [Navigation, chapter jumps, interruption](#6-navigation-chapter-jumps-interruption)
7. [Operational state motion](#7-operational-state-motion)
8. [Reduced motion](#8-reduced-motion)
9. [Performance budgets](#9-performance-budgets)
10. [Technical stack recommendation](#10-technical-stack-recommendation)
11. [Motion test plan](#11-motion-test-plan)

---

## 1. Global principles

1. **Motion explains the data or the place you're in. Nothing moves just to decorate.**
   - The ring rotates *to* a place.
   - Nodes travel *to* their own polygon.
   - Pulses travel *along* a real corridor.
   - The operating point slides *along* the fitted curve.
2. **There are two motion modes, borrowed from the reference:**
   - **Scrubbed.** A pure function of scroll progress. It is reversible and has no internal state. Used for continuous camera moves, zooms, morphs, card decks and word reveals.
   - **Stepped.** Crossing a progress threshold triggers a timed transition, which can be retargeted. Used for discrete states: dial anchors, statements swapping, argument cards, cluster recolour.
3. **One luminous form at a time.** While the ring is bright, there is no orb, and the reverse also holds. In S05 the Solar pressure glow sits behind a dimmed map, and in S08 the Spectral rim is the only light.
4. **Light-blue structure is slow; orange pulses are quick.**
   - Structure moves at 800-1200ms with long settles.
   - Pulses travel at a constant visual speed of 600 px/s on D and 400 px/s on M. They never ease, because they represent flow, not arrival.
5. **Keyed continuity.** Anything representing a zone is keyed by LocationID and **travels**. It never cross-fades between two positions. The same rule holds for borough rows, cluster labels and chords (keyed `o-d`).
6. **Settle, don't bounce.** There are no springs with overshoot on data marks. Overshoot would misreport values. Springs are allowed only on UI chrome (bottom sheets), with damping ratio 1.0 or more.
7. **The visitor always wins.** Any input (scroll, key, tap) retargets or completes an animation immediately. Nothing queues, and nothing blocks scroll.

## 2. Hard rules

Each rule is checked in QA.

| Rule | Test |
|---|---|
| **LCP:** the S00 headline is in the DOM and painted from first paint as ghost text (opacity 0.32, `filter: blur(12px)`), **never opacity 0**. The reveal sharpens that same element. The display font is preloaded (`<link rel=preload as=font crossorigin>`, latin subset), uses `font-display: swap`, and has a metric-matched fallback (`size-adjust`, `ascent-override`) so the swap causes no CLS. | Lighthouse trace: the LCP element is `h1[data-hero]`, LCP is 2.5s or less, CLS is 0.1 or less (mobile and desktop presets). |
| Animate only `transform`, `opacity` and (for at most 14 word spans at once) `filter`. Canvas and WebGL draw their own pixels. Never animate width, height, top/left, box-shadow or backdrop-filter. | A DevTools performance trace shows no Layout events inside scrubbed frames. |
| A single `requestAnimationFrame` loop owns everything: Lenis, progress, tweens and canvas draws. No component starts its own rAF. | Grep for `requestAnimationFrame` finds one call site (`src/motion/loop.ts`). deck.gl's internal loop is the exception: it is paused when deck isn't visible. |
| No artificial delays and no fake progress. Pending UI exists only while a real fetch or worker task is in flight. | Vitest plus code review: there is no `setTimeout` gating any data display. |
| There are no animations on hidden or offscreen stages. | Playwright: with S07 in view, the canvas draw counter for the ring scene stays flat. |

## 3. Token mapping

Values come from `shared/design-tokens/tokens.css` and the measured reference (0.2 / 0.35 / 0.8 / 1.2 / 1.4s).

| Token | Value | Used for |
|---|---|---|
| `--motion-fast` | 200ms | Nav hover bg (reference: 0.2s ease-in-out), tooltip in/out, mobile pill label swap, chord exit, deck handoff crossfade |
| `--motion-standard` | 350ms | Argument card stack (reference: `all .35s ease-in-out`), chord enter, the intro completing on scroll, chapter-jump stage fade-in, chip active block, button press |
| `--motion-panel` | 600ms | Data transitions (node sizes, colours, numerals, borough re-sort), the operating point, inspector enter, statement exit, pulse wave around the ring |
| `--motion-card` | 800ms | Story-card settle, incoming dial title, elevation transitions, 2D/3D pitch, chord fan draw-in |
| `--motion-scene` | 1200ms | The dial rotation (reference: `transform 1.2s cubic-bezier(.33,1,.68,1)`), camera flyTo, the closing echo pulse, intro headline reveal span |
| `--ease-premium` `cubic-bezier(.5,0,0,1)` | | Entrances and departures of objects (nodes into the ring, cards, nav enter, chord draw-in, title exit) |
| `--ease-symmetric` `cubic-bezier(.5,0,.5,1)` | | Scrubbed position interpolation (zooms, morph per-node path, camera pitch on scroll), so a reverse scroll feels identical |
| `--ease-smooth` `cubic-bezier(.33,1,.68,1)` | | Stepped settles (dial rotation, data value tweens, operating point, word sharpening) |
| `linear` | | Pulses along chords, story progress segment fill, time-scrubber playback position, the intro time code |
| `ease-in-out` (CSS keyword) | | Nav hover only (matches the reference exactly) |

These timings fall inside the directive's ranges: hover 120-250ms (200), buttons 150-300 (200-350), panels 250-600 (350-600), charts 400-1000 (600-800), section transitions 700-1800 (800-1200), and cinematic changes 1000-3000 (1200, and the 4.6s intro as a composite).

## 4. The scroll engine

- **Tracks.** Each scene is a `<section>` whose height is the track height (VISUAL_DESIGN 3.1). Inside it, a `position: sticky; top: 0; height: 100dvh` stage. Progress is `p = clamp((scrollY - trackTop) / (trackHeight - innerHeight), 0, 1)`, computed once per frame from Lenis's scroll value, with geometry cached and re-measured only on resize.
- **Active set.** Only the scene containing the viewport, and the next one, receive `update(p, dt)`. All others are paused, and their canvases are hidden with `visibility: hidden` (not unmounted, so they don't re-initialise).
- **Scrubbed animations** are pure functions `f(p)`. A local progress window `[a, b]` is mapped with `s = ease((p - a) / (b - a))`, clamped. They hold no state, so reverse, rapid and jump navigation are exact by construction.
- **Stepped animations** use thresholds with **hysteresis ±0.02**:
  - Going forward, state k becomes active when p rises above `t_k + 0.02`.
  - Going backward, it releases when p falls below `t_k - 0.02`.
  - This prevents flicker while the visitor hovers on a boundary.
- **Retargetable tweens.** One `Tween` utility: `{from, to, start, duration, ease}`. Calling `retarget(newTo)` mid-flight restarts from the *current interpolated value*, with the full duration (no queue). For angles, it uses the shortest signed path.
- **Smooth scroll.** Lenis has `lerp 0.1` on D and `syncTouch: false` on touch devices (native touch scrolling on T/M, so iOS momentum is preserved). Lenis is disabled entirely under reduced motion.

## 5. Animation specifications

Format for each entry:

- **Trigger**
- **Initial → End**
- **Duration / Easing**
- **Sync** (scrubbed or stepped)
- **Interruption**
- **Input**
- **Reduced motion**
- **Performance**

### 5.1 S00 intro: "The Awakening" (4.6s total)

| Time (ms) | What happens | Duration / easing |
|---|---|---|
| 0 | First paint: black, the ghost headline (opacity 0.32, blur 12px) at its final position, the mono corner labels and SKIP INTRO. The canvas starts after the fonts are ready, or at 300ms, whichever comes first. | |
| 0-200 | Corner labels fade in (0 to 1) | 200, linear |
| 300-500 | The busiest-pair origin and destination nodes appear at their geographic positions (4px squares, scale 0 to 1) | 200, premium |
| 500-1100 | The first chord draws from o to d: stroke progress 0 to 1, with an orange pulse riding its head and leaving a light-blue line | 600, premium (line); pulse linear |
| 300-3000 | The time code counts 00:00 to 23:59 | linear |
| 1100-2300 | **Ignition.** The remaining 599 chords of `od_ring_top.json` ignite in *descending trips order*. Chord i starts at `1100 + 1200 x (i / 599)^0.6` and its alpha rises 0 to target over 350ms (standard, premium). A node appears (200ms) the first time a chord touches it. About 80 random chords (seeded) also carry one pulse. | |
| 2200-2800 | **Camera pulls up.** The geographic network's projection scale goes x1 to x0.55 around the city centre | 600, symmetric |
| 2500-3500 | **The system emerges.** Every node travels from its geographic position to its R0 ring position, staggered by `ring_index` over 0-200ms. Chords re-curve with their nodes, and the control point lerps to the ring-interior bezier. | 800 per node, premium |
| 3300-4500 | The ring dims to 0.3 opacity and its radius grows x1.15 (it recedes behind the text) | 1200, smooth |
| 3300-4500 | **The headline sharpens** word by word: 6 words, each blur 12 to 0 and opacity 0.32 to 1 over 600ms, staggered 120ms (600 + 5 x 120 = 1200) | 600 per word, smooth |
| 4200-4550 | The nav enters (translateY 24px to 0, opacity 0 to 1) | 350, premium |
| 4600 | `intro = done`; scroll unlocks. Scroll was never actually locked: input simply completes the intro. | |

- **Interruption.** SKIP, Esc, wheel, a touch move or a keyboard scroll key all **complete** the intro: every element tweens from its current value to its end state over 350ms (`--ease-premium`). The scroll input is then honoured. The intro never rewinds.
- **Replay.** REPLAY INTRO (nav right end, and the S08 links) scrolls instantly to the top, resets the state and plays again. It also writes `sessionStorage['atlas.intro']` (try/catch). A first visit plays the intro; a repeat visit in the same session starts at the end state.
- **Reduced motion.** No timeline. The end state renders on the first frame (R0 at 0.3 opacity, sharp headline, nav visible). The pulses are not drawn.
- **Performance.**
  - Canvas2D, DPR at most 2 (D) and 1.5 (M).
  - Chords are batched into 8 alpha buckets, one `stroke()` per bucket.
  - Pulses are capped at 80, drawn as 3px squares with a 24px tail using `globalCompositeOperation='lighter'`.
  - The headline is DOM, never canvas.

### 5.2 Word blur reveal (S01 statement, S08 paragraph, statement swaps)

- **Scrubbed variant.** S01 and S08, like the reference. For N words in the window `[a, b]` with an overlap of w = 3 words: `local_i = clamp(((p - a) / (b - a)) x (N + w) - i, 0, w) / w`, then `e = ease_smooth(local_i)`.
  - `filter: blur(12px x (1 - e))`
  - `opacity: 0.32 + 0.68 x e`
  - `transform: translateY(0.06em x (1 - e))`
- **Stepped variant** (statement swaps in S03a, S04, S05). Outgoing words: opacity to 0 and blur to 6px over 350ms, all at once. Incoming words: per-word 600ms with a 60ms stagger, `--ease-smooth`, starting 200ms after the exit begins.
- **Interruption.**
  - Scrubbed reveals are pure, so they stop wherever the visitor stops.
  - Stepped reveals retarget: a reverse threshold swaps back, starting from the current per-word values.
- **Performance.**
  - Revealed words get `filter: none` (the property is removed, not set to 0).
  - Unrevealed words carry a static blur.
  - `will-change: filter, opacity` only on the up to 3 x w words inside the active window. At most 14 spans animate `filter` at once. On the LOW quality tier, blur is replaced by opacity only.
- **Reduced motion.** The text is static and sharp, with no blur at any time.
- **Accessibility.** Words are spans inside one heading. Screen readers get the full text from the start, with no `aria-hidden` on words.

### 5.3 Ring zoom R0 to R1, and back (S01 p 0-0.4; S03a to S03b; S02 end; S04 p 0-0.3)

- **Scrubbed.**
  - The radius interpolates in **log space**: `r = r0 x (r1 / r0)^s`, so the zoom feels uniform.
  - The centre interpolates linearly in s, with `s = ease_symmetric(local)`.
  - Chord alpha fades as `alpha x (1 - s)^2`, so the chords are gone before the horizon state.
- **Reverse** is exact (pure).
- **Performance.** The canvas redraws every frame during scrub. The Canvas2D path is cheap, under 3ms on D at 600 chords.
- **Reduced motion.** It jumps to the scene's resting state.

### 5.4 Story-card choreography (S02)

| Local p | Motion |
|---|---|
| 0-0.12 | Card 1 rises from below the fold to the centre: translateY 60vh to 0, scrubbed, symmetric |
| 0.12-0.88 | The row translates left, scrubbed: `x = -(cardWidth + 8) x k(p)`, where `k` steps between integer card indices with a **soft plateau**. Inside each card's band, the first 60% holds still (plateau) and the last 40% eases with `--ease-symmetric` to the next card. The active card sits at the stage centre. |
| per card | The progress segment fills over the card's plateau as a scrubbed scaleX 0 to 1 from the left (`transform-origin: left`). Segments of finished cards are white; future ones are 50% white. |
| on activation | The card's visual zone animates as a **stepped** 800ms premium transition: card 1's field rows light sequentially (80ms stagger), card 2's strip segments grow from 0 width via scaleX, card 3's ledger numerals tween 0 to value (600ms smooth, tabular) and its check mark appears last, card 4's micro-grid squares fill by ring order (2ms stagger). Leaving the card resets this, so re-entering replays it. |
| 0.88-1 | The deck exits left (translateX -40vw, opacity to 0.4) while the ring zooms back out from R1 to R0c (5.3) |

- **Card 1 orb.** Its hue does not shift (unlike the reference). It slowly rotates its internal gradient angle at 8 deg/s **only while active**, which is an ambient cue that the card is live. It stops when inactive or under reduced motion.
- **Interruption.** Scrubbed, so it's pure. Visual-zone tweens retarget or reset on activation changes.
- **Input.** A segment tab click jumps scroll instantly (`lenis.scrollTo(immediate)`) to that card's plateau start. The visual-zone tween then plays.
- **Reduced motion.** The deck becomes a vertical list in normal flow, and the visual zones render at their final values.
- **Performance.** All transforms are on the row element (one composited layer). Orbs are cached bitmaps.

### 5.5 Ring breath (S03a)

- **Scrubbed hour.** p 0.1-0.9 maps to the float hour 0-23.99. Node size is `lerp(size[floor h], size[ceil h], frac(h))` per zone.
- **Readout.** Shows `floor(h)` and updates instantly (tabular numerals, no tween, so no layout shift).
- **Chords.** When the hour band changes during scrub, outgoing chords fade (200ms) and incoming chords fade in (350ms). Chords present in both sets tween their alpha (600ms smooth).
- **Peak pulse wave.** When `floor(h)` equals the AM or PM peak hour (forward or backward crossing), one orange wave travels clockwise around the ring: a 40-degree arc gradient over 600ms, linear. It plays once per crossing, and further crossings within 1s are ignored.
- **Day type and service changes (stepped).** Node sizes and the readout tween 600ms with `--ease-smooth`, keyed by zone. The chords do **not** change, because `od_top` has no day-type or service split (the on-screen label says `CHORDS: ALL DAYS · ALL SERVICES`). Rapid toggling retargets.
- **Reduced motion.** Four static frames, with the controls still functional and redrawing instantly.

### 5.6 Corridor dial steps (S03b), the signature stepped transition

At a threshold crossing (or a marker click):

1. **Rotation.** The ring angle tweens to the anchor's target (anchor at 12 o'clock): **1200ms `cubic-bezier(.33,1,.68,1)`**, shortest signed path.
2. **Title exit.** The outgoing anchor title tweens `rotate(0 to -8deg)`, `translateY(0 to -12px)`, opacity to 0 over 600ms premium. Its `transform-origin` sits at the ring centre side (bottom-centre), so it visibly tilts away with the rotation, as in the reference.
3. **Title enter.** The incoming title starts at 300ms: `rotate(8deg to 0)`, `translateY(12px to 0)`, opacity 0 to 1 over 800ms smooth.
4. **Body.** The outgoing body fades over 350ms. The incoming body starts at 400ms (600ms smooth). The ledger rows re-key with a FLIP (600ms premium).
5. **Chord fan.** Outgoing chords fade over 200ms when the rotation starts. Incoming chords **draw from the anchor outward** (stroke progress 0 to 1) starting at 600ms, 800ms premium, with a 15ms stagger by rank. Pulses start on a chord only after it has fully drawn.
6. **Marker and tick.** The 16px marker swaps colour (200ms) at the top when the rotation reaches 90%. The dotted tick draws downward (scaleY 0 to 1, 350ms premium).
7. **Tickets.** Fade and translateY 8px to 0 (350ms), staggered 40ms, after the chords finish.

- **Interruption.**
  - A new target mid-rotation retargets from the current angle (step 1).
  - Steps 2-7 restart for the new anchor, and in-flight exits finish quickly (200ms) rather than being abandoned.
  - **Rapid multi-threshold scroll** goes directly to the final anchor in one 1200ms rotation, with no chaining.
- **Input.**
  - A marker or node click sets `overridden = true` and runs the same choreography.
  - HOUR BAND chips only re-key the chords (step 5) and ledger (step 4), with no rotation.
- **Reduced motion.** Rotation 0ms, titles and bodies swap instantly, chords render complete, no pulses.
- **Performance.** The canvas redraws only while a tween is active or the progress changes. In the idle state, only the pulses draw (at most 120).

### 5.7 Ring to map morph and extrusion (S04)

| p | Motion | Sync |
|---|---|---|
| 0-0.3 | R1 to R0 zoom (5.3) | scrubbed |
| 0.3-0.65 | **The morph.** Node k has a window `[s_k, s_k + 0.2]` with `s_k = 0.3 + 0.12 x (borough_order / 5) + 0.03 x (rank_in_borough / n_borough)`. Its position is `lerp(ringPos_k, project(centroid_k), ease_symmetric(local))`, where `project` is `WebMercatorViewport` from `@math.gl/web-mercator` built from the exact deck.gl target view state (pitch 0). Chords re-curve: the control point goes from the ring-interior bezier to the chord midpoint, so the chords end straight. | scrubbed |
| 0.65 | **The handoff.** When p reaches 0.65 and deck is ready: the deck canvas opacity goes 0 to 1 and the Canvas2D canvas goes 1 to 0, over 200ms, time-based (not scrubbed). Below 0.63 the handoff reverses. The positions are identical by construction (a 1px parity test). | stepped (hysteresis 0.02) |
| 0.65-0.85 | Polygons fade in (layer opacity 0 to 1 over the first 0.05). `viewState.pitch 0 to 50`, `bearing 0 to -18`, set per frame. `elevationScale 0 to 1` is set per frame (a layer prop: no attribute recompute, so it's cheap). | scrubbed |
| 0.85 | **CONCENTRATION.** Zones outside the top-N half-of-pickups set tween fill alpha to 25% (`transitions.getFillColor` 600ms smooth). The statement swaps (5.2 stepped). | stepped |
| 0.92 | **CLUSTERS.** Fill colours tween to cluster colours (600ms). Direct labels fade in (350ms, 40ms stagger). | stepped |

- **HEIGHT metric change** (after landing). `transitions.getElevation` 800ms smooth, keyed by LocationID. A NET sink renders as a hollow outline, with the height tweening to |value|.
- **Interruption.** Scrubbed phases are pure, so a reverse scroll un-morphs exactly. Stepped phases follow hysteresis.
- **Reduced motion.** Three static states (ring, landed map, concentration) are swapped instantly at thresholds. The pitch is fixed at 50.
- **Performance.**
  - deck.gl is created at S03b entry (warm), with `useDevicePixels` at most 1.5 on D and 1 on M.
  - The 263 extruded polygons are cheap.
  - The Canvas2D morph draws 263 squares plus at most 300 chords.

### 5.8 Chart and data transitions (keyed, everywhere)

| Element | Key | Transition |
|---|---|---|
| Numerals (readouts, result line, ledger, inspector) | field id | Tween the value over 600ms smooth. Font is tabular (`font-variant-numeric: tabular-nums`), in a fixed-width `ch` box, so there is no layout shift. Integers round per frame. Decimals keep a fixed precision. |
| Borough delta list (S06), corridor ledger (S03b), top destinations (inspector) | borough / `o-d` / zone id | FLIP re-sort 600ms premium (Motion `layout`). Enter: opacity 0 to 1 and x 8px to 0 (350ms). Exit: opacity to 0 (200ms). |
| Bars (S06, S07 mini ledger) | id | scaleX from the left, 600ms smooth. Simulated bars keep their hatch while scaling (the pattern sits in a child that counter-scales, or uses `background-size` fixed in px). |
| Map elevation / fill (deck.gl) | LocationID | `transitions: {getElevation: {duration: 800, easing: easeSmooth}, getFillColor: {duration: 600, easing: easeSmooth}}` |
| Profile line (inspector sparkline) | zone id | Path morph between equal-length 168-point arrays (d3-interpolate on the y values), 600ms smooth |
| BPR curve, scenario curve (S05) | borough | The y arrays (120 samples each) interpolate over 600ms smooth. The scenario curve's dash offset stays fixed (no marching ants). |
| Empty dataset | n/a | Marks tween to 0 or hollow (600ms). The empty copy fades in (350ms). Scales **do not** collapse to a zero domain; they keep the last non-empty domain until data returns. |
| Scale/domain change | axis | Hairlines and their direct labels tween position (600ms). Labels cross-fade (200ms) if their text changes. |

### 5.9 Time scrubber playback (OBS)

- **Drag.** Hour-of-week follows the pointer, projected onto the arc (nearest of 168 positions). The marker moves directly with no tween. Data transitions use **0ms while dragging**. On release, a 350ms smooth settle snaps to the hour and data transitions resume at full duration.
- **PLAY.** The hour advances at 4 h/s on D and 2 h/s on M, a 250ms (D) or 500ms (M) step interval. The marker moves *linearly* between positions (continuous). Data transitions per step use `min(800, 0.8 x stepInterval)` = 200ms (D) or 400ms (M), so they never pile up. Playback wraps from 167 to 0.
- **Pause** on: Space, the PAUSE button, any drag, tab hidden, OBS out of view, or reduced motion.
- **Keyboard.** Arrows move ±1 hour, PageUp/Down ±24, Home/End to the extremes. Each keypress uses 200ms transitions.
- **Reduced motion.** PLAY steps hourly (one step per 1s) with 0ms transitions. The marker jumps.

### 5.10 Region select and camera moves (OBS, inspector)

- **SCALE CITY / BOROUGH / ZONE, borough chips, zone search.** deck.gl `FlyToInterpolator({speed: 1.4})` with `transitionDuration: 1200` and `--ease-smooth` easing.
- **Region highlight.**
  - Non-region zones tween to 20% alpha (600ms).
  - The region's top in/out OD arcs (at most 25) draw in over 800ms premium, staggered 20ms.
  - Arcs grow from the origin: `getSourcePosition` is fixed, and the target interpolates via a custom `uProgress` on the ArcLayer, or by fading in the layer opacity if the engineer avoids a custom shader.
- **Interruption.** A new selection mid-flight retargets from the current viewState (deck's `transitionInterruption: TRANSITION_EVENTS.UPDATE`). The highlight re-keys.
- **2D/3D.** Pitch 45 to 0 (or back) over 800ms smooth. Elevation scale goes 1 to 0 in 2D (extrusion flattens with the pitch).
- **Reduced motion.** `transitionDuration: 0`.

### 5.11 Scenario recompute (S05 lab, S06)

- **Computation** is synchronous and under 1ms (5 boroughs x 168 hours x a closed-form BPR). **There is no pending state for recompute.** A pending state exists only while `bpr_fit.json` is loading: controls `aria-disabled`, 50% white, and the mono line `LOADING MODEL PARAMETERS · 38%` with real byte progress.
- **On input change:**
  - The operating point tweens along the curve. Interpolate the **x value** and recompute y on the curve (so the point never leaves the curve), 600ms smooth.
  - The scenario curve morphs its y array (600ms).
  - The result numerals tween (600ms).
  - The Solar pressure glow scale and opacity tween (800ms smooth).
  - The `SIMULATED` chip pulses **once per session** on the first change (opacity 0.6 to 1, scale 0.98 to 1, 350ms). This is the only attention cue.
- **Slider drag.** Values update every rAF and the tweens retarget each frame (they behave as a smooth follow, never lagging more than 600ms). `aria-live` is debounced 400ms after the last change.
- **RESET.** All tweens run to defaults over 600ms, and the result text returns to the observed values.
- **Extrapolation.** When x1 exceeds `x_max_observed`, the curve segment beyond it switches from solid to dotted (no animation, just a style switch). The warning line fades in over 200ms.
- **S06 future change.** The right half-ring nodes tween their radial offset (600ms smooth, keyed). The dashed outline path morphs with them. The borough list re-sorts with FLIP (600ms).
- **Reduced motion.** Everything is instant, and the glow is static at the final value.

### 5.12 Argument stack (S07)

Each of the 6 exchanges is a stepped threshold:

- **The objection card enters.** translateY 40px to 0, opacity 0 to 1, over 350ms ease-in-out. This mirrors the reference's `all .35s ease-in-out`.
- **The typing indicator** `THE PIPELINE IS TYPING...` shows 3 dots blinking at 400ms intervals. It is shown **only during the 350ms between cards**. It is a transition, not a fake load, and it is skipped under reduced motion.
- **The answer card enters** with the same motion, offset diagonally down-right: x +24px, y +16px on D.
- **Older cards dim and recede:** opacity to 0.35, scale to 0.96 (350ms). Cards older than 2 back translate up and out (opacity 0).
- **Answer mini-visuals.** These play on entry: the scatter points fade in by date order (600ms total), the ledger bars scaleX (600ms).
- **Reverse.** Cards retract in reverse order, with the same timing.
- **Mobile.** Cards older than the latest 2 collapse to 8px slivers (scaleY via clip-path inset, 350ms).

### 5.13 Pulses (flows)

- **Movement.** A pulse travels at a constant speed along its chord or arc (600 px/s on D, 400 on M), linear. It is a 3px square head with a 24px fading tail.
- **Spawning.** Seeded Poisson spawning per OD pair, rate proportional to trips.
- **Limits.** At most 120 concurrent on D and 40 on M in the ring scenes. In OBS, deck.gl `TripsLayer` with precomputed seeded pulse paths and a `currentTime` uniform (zero per-frame JS), at most 600 pairs on D and 150 on M.
- **Reduced motion and the LOW tier.** No pulses: static chords and arcs only, with the label `FLOWS SHOWN AS STATIC LINES`.

### 5.14 Closing (S08)

| p | Motion |
|---|---|
| 0-0.3 | Scrubbed: the map pitch goes 45 to 0, polygons fade to their outlines and then out, and the deck canvas fades out. |
| 0.2-0.6 | The R3 horizon rises (scrubbed, symmetric): the top moves from off-screen to its resting y. The Spectral rim glow (cached bitmap) scales 0.9 to 1. |
| 0.3-0.7 | Paragraph word reveal (5.2 scrubbed). |
| 0.75 | **The echo** (stepped, once per down-crossing): the busiest-pair chord draws across the horizon (800ms premium), a pulse rides it (1200ms linear), and the rim brightens (opacity +0.4 over 600ms smooth, back over 1200ms). The caption fades in (350ms) after the pulse lands. |
| 0.8-1 | The links fade in (350ms, 60ms stagger). |

- **Reverse.** Crossing above 0.75 again resets the echo, so it can play again on the next down-crossing. The caption doesn't duplicate.

### 5.15 Component microinteractions

| Component | Behaviour |
|---|---|
| Square buttons and chips | Hover: bg to white and text to black, 200ms ease-in-out (as the nav). Press: scale 0.97 for 120ms. Focus: a 2px white outline offset 2px, always visible on `:focus-visible`. |
| Segmented controls | The white active block slides between items (Motion `layoutId`, 350ms premium). |
| Range sliders | The thumb is a 16px square. On drag it grows to 20px (200ms). The value label above the thumb follows with no lag. The track fill is light blue (observed controls) or orange-hatched (simulated controls). |
| Tooltips | Opacity 0 to 1 and translateY 4px to 0 over 200ms, delay 80ms on hover-in. Out: 120ms. The tooltip follows the pointer with a 12px offset and is clamped to the viewport. |
| Inspector card | Enters from the right: x 24px to 0, opacity 0 to 1 (600ms premium). On T/M it's a bottom sheet: translateY 100% to the peak height (350ms premium); drag follows the finger; release snaps with a critically damped spring (damping ratio 1). Exit: 350ms. |
| Combobox (zone search) | The list opens with a clip-path reveal downward over 200ms. The highlighted row's background follows with `layoutId` (200ms). |

## 6. Navigation, chapter jumps, interruption

### 6.1 Nav

- **D bar.**
  - Bottom centre, 12px from the bottom.
  - `--surface-glass` with `backdrop-filter: blur(16px)` (static, never animated), square corners.
  - Items are 13px mono uppercase with 8px padding.
  - Hover: 200ms ease-in-out to white.
  - The active item is a **white block that slides** between items (Motion `layoutId`, 350ms premium) when the scene changes.
  - The right end holds REPLAY INTRO and the MOTION ON/OFF toggle (writes the user preference, which overrides the OS setting in-session).
  - SKIP INTRO sits bottom-right during the intro only.
- **Nav entry.** Part of the intro (5.1). During OBS EXPLORE mode, the nav hides (translateY 24px plus opacity, 350ms) and returns on exit.
- **T/M MENU pill.**
  - A 160x32 white pill at the bottom centre, showing the current scene's nav label. The label cross-fades over 200ms on change.
  - On tap, a blurred list expands **upward** via clip-path inset (from the bottom, 300ms premium), items fading in with a 30ms stagger. The icon morphs from "=" to "-": the top bar translates to the centre, the bottom bar fades (300ms).
  - Close: the reverse (250ms), and also on Esc, an outside tap, or item selection.
  - The list includes REPLAY INTRO and MOTION ON/OFF.
- **Active scene.** The scene whose stage covers the viewport centre line (computed in the loop, no IntersectionObserver churn). S08 keeps OBSERVATORY active, because the closing has no nav item.

### 6.2 Direct chapter jumps: decision **instant, with a stage fade-in**

The reference jumps instantly (scrollY reached its target within 190ms; `nav-desktop.json`). We follow that, for these reasons:

- **Behaviour.** A smooth scroll across up to 20 viewports would run every scrubbed scene in between: the morph runs backwards, the cards fly past, and the dial steps fire. That is noise, it is expensive, and it takes over 1.5s.
- **Cost.** Scrubbed scenes are pure functions of progress, so an instant jump renders a correct frame immediately. There is no catch-up state to replay.

**Procedure:**

1. `lenis.scrollTo(target, {immediate: true})`.
2. The target stage content (DOM layer) goes opacity 0 to 1 over 350ms smooth. The canvas and deck render the target state directly, with no tween.
3. Every stepped state between the old and new positions is resolved to its correct value *without* animation, by evaluating thresholds against the new progress.
4. The URL hash updates with `history.replaceState` (`#corridors`). Back and forward (`popstate`) jump the same way.
5. Focus moves to the target scene's heading (`tabindex=-1`) for keyboard and screen-reader users.

**Landing progress per scene** (the "entry-resolved" state, so a jump never lands on a blank half-state). Every landing value sits strictly inside its stepped band, at least 0.03 clear of any threshold plus or minus hysteresis:

| Scene | Landing p |
|---|---|
| S01 | 0.78 |
| S02 | 0.14 (card 1 centred) |
| S03a | 0.35 (approaching the AM peak) |
| S03b | 0.05 |
| S04 | 0.89 (landed map, concentration; strictly inside the band above the 0.85 + 0.02 hysteresis edge) |
| S05 | 0.40 (lab live) |
| S06 | 0.10 |
| S07 | 0.05 |
| OBS | section top |

### 6.3 Scroll interruption

| Case | Behaviour |
|---|---|
| Reverse scroll | Scrubbed: exact reversal, because animations are pure. Stepped: hysteresis ±0.02, and in-flight tweens retarget from their current value. Intro: input completes it (5.1). |
| Rapid scroll / scrollbar drag / fling | Stepped states resolve to the final state in one transition (no chaining). If a scene was entered and left within 200ms, its stepped animations are skipped entirely and its state is set directly. |
| Mid-transition scene exit | Tweens keep running for at most their remaining duration, then the scene pauses. A scene re-entered within 1.2s continues from its current values. |
| Resize / orientation change | `ResizeObserver` on the root, debounced 150ms. (1) Record the current scene and p. (2) Snap all in-flight tweens to their targets. (3) Re-measure tracks and recompute ring geometry from the viewport-class table (D/T/M breakpoints at 768 and 1024). (4) Restore `scrollY = trackTop + p x (trackHeight - innerHeight)` with `immediate`. (5) Refit the deck view state. Nothing animates during a resize. |
| Tab hidden | The rAF loop stops (`visibilitychange`). Playback pauses, and resumes in the paused state. |
| Long task / jank | Scrubbed frames use the latest progress (frames are skipped, never queued). Tweens are time-based (`performance.now()`), so they complete on time even at low fps. |

## 7. Operational state motion

| State | Motion |
|---|---|
| **Initial** | The scene skeleton is visible immediately: the ring outline (1px, 16% white) in the scene's ring state, headings sharp. There is no shimmer and no spinner. |
| **Loading** | The mono line `LOADING {ARTIFACT} · {n}%`. The percentage updates from real stream progress (no tween; it jumps). If the total is unknown, three dots blink at 400ms. Fade-in is 200ms and only starts if loading lasts 150ms or longer (avoids flashes). |
| **Ready** | The data marks enter via their keyed transition (5.8) from the skeleton: nodes scale 0 to 1 (350ms premium, 1ms stagger by ring index), chords fade in (350ms). |
| **Empty** | Marks tween to hollow or 0 (600ms). The scene-specific empty copy fades in (350ms). Controls stay enabled, so the visitor can leave the empty state. |
| **Error** | The loading line cross-fades (200ms) to `COULD NOT LOAD {ARTIFACT} ({reason})` in `--state-error`, with a `RETRY` square button. No shake. |
| **Retry** | Pressing RETRY re-runs the same fetch. The button shows `RETRYING` while it's in flight, then the loading line returns. On a second failure the error returns, with the attempt count `(ATTEMPT 2)`. |
| **Success** (after a retry or reset) | The data enters as in Ready. There is no toast. |
| **Disabled** | 50% white, `aria-disabled`, cursor not-allowed. The tooltip explains why (e.g. `SET A SCENARIO IN PRESSURE FIRST`). No motion on hover. |
| **Reset** | All affected values tween to their defaults (600ms), keyed. The RESET button briefly shows `RESET ✓` for 1.2s (`aria-live`). |

## 8. Reduced motion

Triggered by `prefers-reduced-motion: reduce` **or** the in-site MOTION OFF toggle. The tokens already zero their durations and blur. Additionally:

1. The intro renders its end state immediately. REPLAY INTRO is still available and plays a 0ms version (the end state).
2. Lenis is off, and the page uses native scroll.
3. **Pinned tracks become normal flow:** the track height is auto and the stage is `position: relative`. Each scene renders its key states as static content:

| Scene | Static rendering |
|---|---|
| S01 | Statement plus the R1 ring plus the cards |
| S02 | 4 cards stacked vertically |
| S03a | 4 frames (00:00, AM peak, 14:00, PM peak) in a grid: 4 columns on D, 2x2 on T, stacked on M. The controls still redraw all 4. |
| S03b | One ring plus a 4-button tablist; anchors switch instantly |
| S04 | The ring image, then the landed map, then the concentration state, with the HEIGHT control live |
| S05 / S06 | Fully functional, instant updates |
| S07 | All 6 exchanges as a vertical list |
| OBS | Fully functional, no playback tweening, instant camera |
| S08 | Static horizon, plus the chord and the caption |

4. There are no pulses. Flows are static lines, labelled `FLOWS SHOWN AS STATIC LINES`.
5. No blur anywhere. Word reveals are off: the text is simply present.

**Test.** Playwright with `reducedMotion: 'reduce'`:

- The document height is under the pinned height.
- No element has `position: sticky` inside a scene.
- A scroll to the bottom completes in under 10 wheel events per 1000px (no traps).

## 9. Performance budgets

| Item | Desktop D | Tablet T / Mobile M | LOW tier (auto) |
|---|---|---|---|
| Frame budget | 16.7ms (60fps); JS 6ms or less per frame | 33ms (30fps); JS 10ms or less | same targets |
| Canvas2D DPR cap | 2 | 1.5 | 1 |
| Ring chords on screen | 600 (R0) / 300 (R0c) / 40 (R1 fan) | 300 / 150 / 40 | 300 / 100 / 40 |
| Concurrent pulses (ring) | 120 | 40 | 0 |
| deck.gl `useDevicePixels` | min(DPR, 1.5) | 1 | 1 |
| OBS flow pairs | 600 | 150 | 0 (static top 100) |
| Word spans animating filter at once | 14 or fewer | 14 or fewer | 0 (opacity only) |
| Glows / orbs | Cached offscreen-canvas bitmaps, max 1024px | max 512px | max 512px |

- **LOW tier detection.** Measure the median frame time over the first 60 scrubbed frames after the intro. If it is over 22ms on D or over 40ms on M, drop to LOW, and record it in `window.__atlasQuality` for tests. `?quality=low|high` forces a tier.
- **Offscreen pause.** Inactive scenes don't draw. deck.gl is created at S03b entry (warm), its canvas is `visibility: hidden` and its loop is stopped outside S04-S06/OBS/S08.
- **Batching.** Chords are bucketed by alpha into 8 paths. Nodes use `fillRect`. Canvases redraw only when dirty.
- **Memory.** One ring canvas, viewport-sized (never 164vw-sized: the ring is drawn by parameters, so its off-screen part costs nothing).
- **Measured, not claimed.** FPS and LCP numbers are reported only from real runs: Lighthouse (desktop and mobile presets), a Playwright trace with frame pacing on a stated device, and the evidence harness. Never estimate them in docs.

## 10. Technical stack recommendation

| Layer | Choice | Reason |
|---|---|---|
| App | React 18 + TypeScript strict + Vite | Program standard (MASTER_PLAN) |
| Styles | `tokens.css` + CSS Modules. Tailwind is optional for layout utilities only, with its default palette disabled. | The design language lives in tokens. No utility colours bypass them. |
| Scroll | Lenis (about 4 KB gz) plus **one** custom rAF loop (`src/motion/loop.ts`) with the track-progress and threshold engine (section 4) | The reference uses Lenis. Pure progress functions plus retargetable tweens cover every scene. |
| GSAP / ScrollTrigger | **Not used in project 01** | Its pinning duplicates CSS sticky and fights Lenis. Our scrub and threshold model is about 150 lines. Its timeline power isn't needed: the intro is a declarative keyframe table (5.1) run by the same tween utility. This saves about 40 KB gz. If the intro grows past about 12 tracks, `gsap` core (not ScrollTrigger) may be lazy-loaded for S00 only. |
| Component motion | Motion (`motion/react`) with `LazyMotion` + `domAnimation` | Layout and FLIP (ledgers, delta list), `layoutId` active blocks, inspector and bottom sheets. Keeps component state transitions declarative. |
| Ring scenes S00-S03b, S04 morph, S06 split, S08 horizon | **Canvas2D** | At most 600 strokes in 8 batches plus 263 rects is well inside budget. It is crisp at any radius, needs no shader complexity, and degrades gracefully. WebGL for the ring would add a second context alongside deck.gl. |
| Map S04-S08 + OBS | **deck.gl 9 standalone** (`@deck.gl/core`, `layers`, `geo-layers` for TripsLayer, `extensions` for FillStyleExtension hatch), `MapView` with **no basemap** | There are no tiles to render, so MapLibre would add about 230 KB gz only for its camera. Deck provides the camera, FlyToInterpolator, controller, picking and GPU attribute transitions. The deck chunk is lazy (about 300-380 KB gz), prefetched with `requestIdleCallback` after the intro, and initialised at S03b entry. |
| Projection parity | `@math.gl/web-mercator` (the same math deck uses), in the main chunk (small) | The Canvas2D morph lands pixel-exactly where deck draws (the 1px test). |
| Charts | `d3-scale`, `d3-shape`, `d3-array`, `d3-interpolate` (tree-shaken), rendered to SVG or Canvas by our own components | The BPR curve, sparklines, scatter and bars stay inside the visual language. No chart library defaults. |
| Fonts | `@fontsource-variable/newsreader` and `@fontsource-variable/jetbrains-mono`, latin subset, display face preloaded | Program decision. Zero external requests (Playwright test). |
| Data | `fetch` with stream progress. Hand-written type guards generated from the artifact JSON Schemas (validated at load; a schema mismatch shows the error state). | Validation at the trust boundary without a heavy validator. |
| Workers | None initially. The BPR model is closed-form and under 1ms, and pulse sampling per band takes milliseconds. Add a worker only if a trace shows a main-thread task over 50ms. | YAGNI with a measured trigger. |

**Bundle and loading budget** (Lighthouse perf 90+, LCP 2.5s or less, CLS 0.1 or less):

| Resource | Budget (gz) | When |
|---|---|---|
| HTML + critical CSS | 25 KB or less | first paint |
| Main JS (React, app shell, loop, Lenis, Motion lazy core, d3 subset, web-mercator, Canvas2D ring) | 180 KB or less | first paint, `type=module`, deferred |
| Fonts (2 latin woff2 subsets) | 120 KB or less, display face preloaded | first paint |
| Initial data: `zones_index.json`, `od_ring_top.json`, `facts.json` | 40 KB or less | parallel with the JS |
| Scene data (`zone_hour_week`, `od_top`, `network`, `reconciliation`, `meta`) | 400 KB or less total | idle after the intro, or S01 entry |
| deck chunk + `zones.geojson` + `zone_month` + `clusters` + `bpr_fit` | 380 KB + 150 KB or less | prefetched at idle; required at S04 / S05 |
| OBS-only (`od_matrix_totals`, `daily`, `weather_model`) | 300 KB or less | at S07 entry |

**LCP path.** The HTML has the `h1` ghost headline, critical CSS and the preloaded display font, so the LCP element is ready with no JS. The canvas intro starts after first paint. Measure with Lighthouse mobile (simulated 4G, 4x CPU) and desktop presets. Total Blocking Time is controlled by keeping the main chunk at 180 KB or less and deferring canvas initialisation to the first rAF after `document.fonts.ready` (with a 300ms cap).

## 11. Motion test plan

Playwright runs against the production build (`npm run build && npm run preview`) at D, T and M.

1. **Intro.** SKIP is visible at 100ms. Clicking it shows the nav within 400ms. A wheel at 1s completes the intro within 400ms. A reload in the same session starts at the end state. Under reduced motion, the end state shows at the first screenshot.
2. **LCP and CLS.** The Lighthouse JSON asserts the LCP element selector is `h1[data-hero]`, LCP is 2.5s or less, and CLS is 0.1 or less.
3. **Track release.** For each scene, scroll to its track end plus 10px: the next scene's heading is in the viewport. No scene keeps `scrollY` from increasing (no traps).
4. **Reverse and rapid.**
   - Fling from S01 to S06 in under 300ms, then back: the final states match a direct load of the same progress (screenshot diff under 0.5%).
   - The S03b anchor at p = 0.6 is Brooklyn, both forward and backward.
5. **Chapter jumps.** For each nav item: after the click, scrollY is within 2px of the landing progress within 200ms, the hash updates, and back/forward restores. Focus is on the scene heading.
6. **Resize mid-scene.** At S04 p = 0.5, resize from 1440 to 390: the scene and p are preserved within ±0.01, there are no console errors, and the ring geometry matches the M table.
7. **Morph parity.** At S04 p = 0.65 the Canvas2D node centres are within 1px of `deck.viewports[0].project(centroid)` for 263/263 zones.
8. **Data transitions keyed.** After changing the HEIGHT metric, the deck `getElevation` transition runs (the layer's `transitions` prop is set), and node ids before and after are equal (no remount).
9. **Scenario.** Lab at m = 1 and dc = 0 equals the observed values (exact). Dragging DEMAND updates the `aria-live` text after 400ms or more. RESET restores. The SIMULATED chip and hatch are present whenever the scenario differs from the observed values.
10. **OBS scroll safety.** A wheel over the map outside EXPLORE scrolls the page. EXPLORE locks scroll, and Esc restores it with scrollY unchanged.
11. **Reduced motion.** No sticky positioning in scenes, no filter blur computed on any word, no running rAF draws after idle (the draw counter is stable), and all controls still work.
12. **Pause offscreen.** With OBS in view, the ring canvas draw counter is stable for 2s. With S02 in view, `deck` is not rendering (the frame counter is stable).
13. **Frame pacing** (evidence harness). A scroll recording at D and M, with frame-time percentiles reported (p50/p95), on a stated device and browser. Results are recorded, never asserted from estimates.
