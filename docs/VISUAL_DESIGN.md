# Visual design: Atlas of Human Mobility ("The City Never Stops Moving")

Phases 14-16: creative reference research, three competing concepts with a scored selection, and
the experience blueprint. The motion bible (phase 17) is `MOTION_SYSTEM.md`. Author: Creative
Director, 2026-10-10.

## Contents

0. [Binding inputs](#0-binding-inputs)
1. [Reference research (phase 14)](#1-reference-research-phase-14)
2. [Three concepts and the selection (phase 15)](#2-three-concepts-and-the-selection-phase-15)
3. [Experience blueprint (phase 16)](#3-experience-blueprint-phase-16)
4. [Signature interactions](#4-signature-interactions)
5. [Copy deck](#5-copy-deck)
6. [Placeholder bindings and data requests](#6-placeholder-bindings-and-data-requests)
7. [Hard rejection criteria](#7-hard-rejection-criteria)

---

## 0. Binding inputs

These are inputs to the design, not choices it makes:

- **Shared language:** `design/reference-analysis.md` and `design/interaction-inventory.md`. Evidence images were opened and read for this document: `sheet-desktop-scrollA/B.png`, `sheet-mobile-scrollA.png`, `interactions/card-fullres.png`, `interactions/sheet-mobile-menu.png` and `desktop/intro-3500ms.png`.
- **Tokens:** `shared/design-tokens/tokens.css`. **Fonts:** Newsreader (display) and JetBrains Mono (everything else), per `design/fonts/DECISION.md`.
- **Data:** only the artifacts in `DATA_CONTRACTS.md`, plus the requests in [section 6](#6-placeholder-bindings-and-data-requests). No individual coordinates or trajectories exist. Every line on screen connects two zone centroids and is labeled that way.
- **What we take from the reference** (principles only, never assets or copy):
  - black stages with one luminous form
  - oversized serif statements revealed word by word through blur
  - uppercase mono for all UI and body copy
  - 100dvh sticky stages in long tracks
  - a 164vw ring used as a dial, with square colored markers and a dotted tick
  - threshold-stepped 1.2s rotations
  - 4-segment story cards
  - an argument card stack
  - a square blur bottom nav and a mobile current-section pill
  - a closing that echoes the opening

### Colour semantics (project 01 rule set)

| Role | Value | Rule |
|---|---|---|
| Primary accent | `#58B8E1` light blue (`--accent-primary`) | OBSERVED structure: the ring stroke, chords, active markers, DERIVED tag. Contrast 9.4:1 on black, so it may also be text |
| Pulse | `#FF4C25` orange-red (`--accent-secondary`) | **In OBSERVED scenes it is motion-only.** It appears only as a *moving* pulse (white core, orange tail) travelling along a chord. It is never a static mark, a fill, a legend swatch or a value encoding |
| SIMULATED | `#FF4C25` plus a pattern | Static orange appears **only** for SIMULATED content, and it always comes with three non-colour cues: (1) dashed strokes (6px dash, 4px gap), (2) 45-degree hatch fill (1px lines at 6px pitch), (3) a persistent `SIMULATED · BPR` chip. Pulses never appear on simulated content |
| Fill-only accents | `#192CE4` blue, `#690DE2` purple | Card fills and 16px dial markers only. A marker using them carries a 1px white outline, which gives non-text contrast of 3:1 or better (WCAG 1.4.11). Never used for text |
| Text | `#fff`, `rgba(255,255,255,.5)` | 50% white is for secondary mono labels at 13px or larger only |
| Surfaces | `#000` stage, `#161616` cards, `#292929` objection cards, `--surface-glass` nav | The light-blue card variant (S02 card 4, S07 answers) uses black text, which gives 9.4:1 |

### Honesty tags

Every visual carries exactly one tag chip: OBSERVED / DERIVED / SIMULATED (13px mono, 8px padding, `#ffffff1a` bg, tag colour from tokens). This project uses no PREDICTED or SYNTHETIC tags. Sampled flow pulses are **DERIVED** ("sampled from aggregate OD counts, seeded"). Weather results are **DERIVED** and labelled "association, not cause".

---

## 1. Reference research (phase 14)

Verification was done on 2026-10-10, by one of these methods:

- **C:** `curl -L` returned HTTP 200, page title read where shown.
- **B:** headed Chromium (Playwright) returned HTTP 200 and the page title was read. This was used where curl got a bot challenge (403/429).
- **R:** the orchestrator's earlier reference capture.

Excluded after checking:

- hubcab.org: a parked domain that redirects to `/lander`.
- senseable.mit.edu/hubcab: timed out.
- Two 2025 Codrops posts (3D circle text, curved path): Cloudflare challenge, so unverified.
- Reuters transit graphics: none found by search.

None of these are cited.

| # | Reference (URL) | Verified | Technique | Motion behaviour | Strength for us | Implementation direction | Originality strategy |
|---|---|---|---|---|---|---|---|
| 1 | Blink Capital, https://blink.capital/ | R | 100dvh sticky stages in 200-300vh tracks, 164vw ring dial, story cards, chat stack, blur bottom nav | 1.2s `cubic-bezier(.33,1,.68,1)` stepped ring rotation; word blur reveal; instant nav jumps | The mandatory grammar for all ten sites | Reuse the *principles* (tracks, dial stepping, card anatomy, nav) via our own components and tokens | Our ring carries 263 data nodes and OD chords, not 3 brand markers. Copy, fonts and imagery are all original |
| 2 | Codrops, "Blurry Text Reveal on Scroll", https://tympanus.net/codrops/2024/04/23/blurry-text-reveal-on-scroll/ | B ("Blurry Text Reveal on Scroll \| Codrops") | Per-word `filter: blur()` + opacity tied to scroll progress | Words sharpen in sequence as progress advances | Confirms the cost warning: animated blur on large text is expensive | Blur is applied per word span, limited to at most 14 words animating at once, and `will-change` is set only during the reveal window | We reveal in *data order* where it matters: numerals arrive last, as the payoff |
| 3 | Codrops, "On-Scroll Animation Ideas for Sticky Sections", https://tympanus.net/codrops/2024/01/31/on-scroll-animation-ideas-for-sticky-sections/ | B ("On-Scroll Animation Ideas for Sticky Sections \| Codrops") | Sticky sections animated as they leave the viewport | Exit transforms on the outgoing stage | How a pinned stage *leaves* (most sites only design the entry) | Every scene defines an exit state (section 3), not only an entry | Our exits are data-continuous: the ring itself carries over between scenes instead of cutting |
| 4 | deck.gl TripsLayer example, https://deck.gl/examples/trips-layer | C | GPU paths with a time uniform and a fading trail | Trails animate along known coordinates | Benchmark for luminous trails on black | **Not used for paths** (we have none). Its trail-fade shader idea drives our chord pulses, which run along centroid-to-centroid curves and are labelled DERIVED | We show honest *pulses on chords* instead of fake street trajectories |
| 5 | deck.gl ArcLayer example, https://deck.gl/examples/arc-layer | C | OD arcs between points, two-colour gradient, height by distance | Arcs pick and highlight on hover | The canonical OD-on-map form | Lifted arcs in S04/OBS for the selected zone's top destinations only (keeps the arc count at 25 or fewer) | Arcs appear only *after* the ring-to-map morph, as the continuation of the chords the visitor has already learned |
| 6 | deck.gl SolidPolygonLayer, https://deck.gl/docs/api-reference/layers/solid-polygon-layer | C | Extruded polygons with `getElevation` and attribute transitions | GPU-interpolated elevation changes | Extruded zones without any basemap | Zones are extruded by trips, using `transitions: {getElevation: 800, getFillColor: 600}` | Black-on-black extrusion lit only by a light-blue top face: no satellite or tile aesthetic |
| 7 | MapLibre, "Extrude polygons for 3D indoor mapping", https://maplibre.org/maplibre-gl-js/docs/examples/extrude-polygons-for-3d-indoor-mapping/ | C (title read) | `fill-extrusion` from GeoJSON | Camera pitch reveals height | Proves self-rendered GeoJSON extrusion without tiles | Considered and rejected for bundle size: deck.gl alone covers it (see the stack in MOTION_SYSTEM.md) | n/a |
| 8 | MapLibre `Map#flyTo`, https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto | C | Van Wijk zoom-out-then-in camera curve | Smooth scale changes | Camera moves between scales feel spatially continuous | The same curve via deck.gl `FlyToInterpolator` for CITY/BOROUGH/ZONE camera moves | Camera moves are always paired with a mono scale readout ("1 : CITY") |
| 9 | Todd W. Schneider, "Analyzing 1.1 Billion NYC Taxi and Uber Trips", https://toddwschneider.com/posts/analyzing-1-1-billion-nyc-taxi-and-uber-trips-with-a-vengeance/ | C | Static analytical charts on TLC data, airport travel-time distributions | None (static) | The analytical bar to clear: specific, sourced, distribution-aware | Our corridor cards show median *and* p10-p90 (from `od_top.json`), never a lone average | Motion and an explorable model on 2024 data, versus his static historical essay |
| 10 | Chris Whong, "NYC Taxis: A Day in the Life", https://chriswhong.github.io/nyctaxi/ | C ("A Day in the Life") | Follows one real cab's day (2013 data with coordinates) | A clock-driven replay | Emotional power of "one journey" | Our intro starts with one signal, but it is the *busiest real OD pair*, not a person, because 2024 data has no coordinates | Aggregate-first honesty: we explicitly do not follow individuals |
| 11 | FlowingData, "A Day in the Life of Americans", https://flowingdata.com/2015/12/15/a-day-in-the-life-of-americans/ | B (title read) | Dots simulated from survey time-use data move between activity clusters | Time-driven dot migration with a clock | A precedent for labelling sampled motion as a simulation of aggregate data | Our pulses are sampled per frame from OD counts (seeded RNG); the label says so on screen | Ours sits on a physical-geometry ring and a map, not abstract clusters |
| 12 | FlowingData, "Where People Go to and from Work", https://flowingdata.com/2016/06/06/where-people-go-to-and-from-work/ | B (title read) | Commute flows between counties as lines | Animated flows | OD storytelling at a regional scale | Flows in OBS are thinned to the top N per selected zone so they stay legible | Interior chords on a ring as the primary OD form, with the map secondary |
| 13 | The New York Times Upshot, "Here Is Everything That Has Changed Since Congestion Pricing Started in New York", https://www.nytimes.com/interactive/2025/05/11/upshot/congestion-pricing.html | B (title read) | An editorial multi-chart explainer on NYC traffic change | Scroll-led chart sequence | Editorial tone: a claim, then the chart, then the caveat | S07 Evidence uses claim / objection / caveat ordering | **No figures from this piece are used.** We do not simulate pricing policy, and our scenarios are capacity/demand only |
| 14 | Observable, D3 "Chord diagram", https://observablehq.com/@d3/chord-diagram | B (title read) | Ribbons between arc groups sized by matrix flow | Static (hover in variants) | The baseline OD-on-a-circle form | We **don't** use group ribbons: 263 individual nodes and single-stroke chords whose alpha and width encode trips | Ribbon chord diagrams are generic. A 164vw dial with a stepped rotation and a fan of chords is not |
| 15 | Observable, D3 "Hierarchical edge bundling", https://observablehq.com/@d3/hierarchical-edge-bundling | B (title read) | Radial node layout with edges bundled through a hierarchy | Hover highlights in/out edges | Reduces hairball clutter on rings | Light bundling: the chord control point is pulled toward the ring centre by k = 0.35 (borough-level bundling optional, flagged as stretch) | Bundling serves the dial reading (local short chords versus cross-city long chords) |
| 16 | Nadieh Bremer, "Presenting the d3.loom chart", https://www.visualcinnamon.com/2017/08/d3-loom/ | C (title read) | Two-sided chord variant with stretched, smoothed curves | Static, art-directed | Shows how custom curve shaping makes OD art legible | Informs concept C (The Loom) and the S06 split-ring comparison | We split our *own* ring into observed and simulated halves for comparison. It is not a loom chart |
| 17 | Nadieh Bremer, stretched chord gist, https://gist.github.com/nbremer/f9dacd23eece9d23669c | C | Pulls chord halves apart to create a gap | Static | A technique to separate two halves of a circular OD layout | Used for the 24px gap between the S06 half-rings | Applied to observed-versus-simulated, a novel use |
| 18 | FlowmapBlue, https://flowmap.blue/ and flowmap.gl, https://github.com/visgl/flowmap.gl | C (titles read) | OD flow maps with clustering, thresholding and animated flow lines | Animated dashes along flows | Best practice: threshold flows, keep them legible, animate direction | Our OBS flow layer is thresholded to the top 600 OD pairs per hour band, with direction shown by pulse motion | Native to our ring-to-map story rather than a generic tool UI |
| 19 | kepler.gl, https://kepler.gl/ | C | Layered geospatial exploration (arcs, hexes, polygons, time filter) | A time playback slider | The feature set an observatory is expected to have | Feature checklist for OBS (time scrubber, layers, 2D/3D) | **Anti-reference for layout:** kepler's sidebar dashboard is exactly what we must not build. OBS uses floating mono controls and an arc scrubber |
| 20 | The Pudding, "Human Terrain", https://pudding.cool/2018/10/city_3d/ | C (title "Human Terrain") | Population as extruded 3D terrain, editorial camera moves | Scroll-driven camera orbits | Extrusion as an emotional reveal | The S04 pitch-up from 0 to 50 degrees with elevation growing from 0 | Our extrusion is keyed to real zone polygons and arrives *from the ring*, with the morph as the reveal |
| 21 | GitHub Blog, "How we built the GitHub globe", https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/ | C (title read) | WebGL arcs with performance budgets, quality tiers and pause-offscreen | Arcs spawn and fade on a globe | Concrete performance discipline (DPR caps, quality tiers) | A quality tier system (section 3 of MOTION_SYSTEM.md) | Different geometry and subject: not a globe |
| 22 | Igloo Inc (Awwwards SOTD), https://www.awwwards.com/sites/igloo-inc | C ("Igloo Inc - Awwwards SOTD") | A cinematic WebGL intro, scroll-driven 3D | A short intro that hands off to scroll | Award-level intro pacing | A 4.6s intro with skip, handing off to the scroll stage with no hard cut | No crystal/ice aesthetic: ours is lines and squares on black |
| 23 | GSAP ScrollTrigger docs, https://gsap.com/docs/v3/Plugins/ScrollTrigger/ | C | Pinning, scrub, snapping | n/a | The industry baseline for scroll-linked timelines | **Not needed here:** one rAF loop over Lenis scroll covers our scrub + threshold model (justified in MOTION_SYSTEM.md) | n/a |
| 24 | Lenis, https://lenis.darkroom.engineering/ | C | Smooth scroll with a normalized virtual scroll | Inertial scroll | The same smoothing the reference uses (`lenis.css` observed) | Lenis drives one progress loop | n/a |
| 25 | Motion, "Layout animations", https://motion.dev/docs/react-layout-animations | C | FLIP layout transitions in React | Shared-layout morphs | Smooth component layout changes (cards, chips, inspector) | Inspector card enter/exit, chip active block, mobile menu | n/a |

---

## 2. Three concepts and the selection (phase 15)

All three use the shared family: black, Newsreader statements, mono UI, sticky stages, ring dial, story cards, argument stack, bottom blur nav and a closing echo. What differs is the metaphor, the behaviour of the signature geometry, the scene composition and the closing.

### Concept A: "Orbital City"

- **Philosophy.** A city is a closed system of exchanges. Unroll all 263 zones onto one circle (in geographic order, borough by borough), and every journey becomes a chord across it. Local life is a short chord, the airport run is a long one. The ring is the system seen whole; the map is the same system seen in place. The site moves between those two views, and the morph is keyed zone by zone (LocationID), so the visitor watches each zone leave the ring and land on its own polygon.
- **Accent use.**
  - Light blue = the observed structure (ring, nodes, chords).
  - Orange-red = moving pulses only, plus static use reserved for SIMULATED.
  - Electric orb for observed glow, Solar orb for simulated pressure, Spectral rim for the closing horizon.
- **Layout.** Asymmetric editorial: statements on a left 5-column measure, geometry to the right or as a horizon. Full-bleed only for the map and the closing.
- **3D/2D strategy.** The ring is Canvas2D (cheap, crisp, rotatable). The map is deck.gl WebGL (extruded SolidPolygonLayer). The handoff is a pixel-matched frame at pitch 0.
- **Hero concept.** One real signal (the busiest OD pair) ignites. More chords follow until a network stands in geographic position. Then the camera pulls up and the nodes gather into the orbital ring: "Millions of journeys. One living system."
- **Nav labels.** CITY · ANATOMY · RUSH HOUR · CORRIDORS · DEMAND · PRESSURE · FUTURES · EVIDENCE · OBSERVATORY
- **Storytelling.** System, then record, then rhythm, then corridors, then place, then stress, then futures, then trust, then exploration, then return.
- **Motion character.** The ring behaves like a dial: deliberate 1.2s steps with a long settle. Pulses are quick and light. The morph is slow and spatial.
- **Responsive approach.**
  - Mobile gets its own ring geometry (a 130vw-radius horizon instead of 82vw, fewer visible nodes, destination "tickets" as a bottom list), a bottom-sheet map, and MENU pill nav.
  - Tablet stacks statement over geometry, with the ring arc centred.

### Concept B: "Tidal City"

- **Philosophy.** Demand is a tide. The city fills and drains on a 168-hour week. Time is the hero, and space is secondary.
- **Accent use.** A Solar orb is the "sun" riding the horizon arc as hours pass. Light-blue zones brighten with the tide. Orange only for simulated "storm" scenarios.
- **Layout.** A horizon composition throughout: the arc always sits at about 50dvh, statements above it, a 2D zone heat map "underwater" below it.
- **3D/2D strategy.** Mostly 2D. A heat-shaded map with no extrusion, and a short 3D moment in the observatory only.
- **Hero concept.** A black sea. The sun orb rises at 05:00, and zones light up as the morning tide comes in. "The city rises with the light."
- **Nav labels.** DAWN · RECORD · TIDE · CURRENTS · SHORES · STORM · FORECASTS · PROOF · OBSERVATORY
- **Storytelling.** A single average week told hour by hour, with chapters as times of day.
- **Motion character.** Slow, continuous and scrubbed: the sun moves one-to-one with scroll, and nothing is stepped.
- **Responsive approach.** The horizon line stays at 50dvh on all devices. Mobile shows the heat map as a vertical strip of boroughs.
- **Weaknesses.**
  - A sun riding a time arc reads as a clock. That is too close to project 04's 24-hour radial demand clock and project 03's year ring.
  - OD corridors, the core output, become secondary.
  - "Sun" and "tide" also imply nature causes demand, which muddies the weather-association caveat.

### Concept C: "The Loom"

- **Philosophy.** The city weaves itself. Origins sit on an upper arc and destinations on a lower arc. Each corridor is a thread pulled between them, and a year of trips is a fabric.
- **Accent use.** Light-blue warp threads (origins), white weft (destinations), orange pulses as the shuttle. The simulated fabric is hatch-patterned.
- **Layout.** The ring is split horizontally like an opening eclipse: the top half-arc is origins, the bottom half-arc destinations, with threads in between. Statements sit in the gap.
- **3D/2D strategy.** 2D loom, then a flat 2D map whose arcs lift slightly (deck.gl ArcLayer) in the observatory.
- **Hero concept.** A single horizontal thread is drawn across black. The ring then splits open around it into two arcs, and threads multiply between them.
- **Nav labels.** THREAD · RECORD · RHYTHM · WEAVE · CLOTH · STRAIN · PATTERNS · PROOF · OBSERVATORY
- **Storytelling.** Thread, warp, weft, cloth, strain, re-weave. Every chapter is a textile operation.
- **Motion character.** The arcs open and close like an eclipse (not rotation), and threads tension with spring-like settles.
- **Responsive approach.** Mobile rotates the loom 90 degrees, putting origins on the left arc and destinations on the right, with threads horizontal.
- **Weaknesses.**
  - Splitting the ring abandons the reference's signature dial rotation (lower fidelity).
  - A bipartite layout doubles the node count on screen (526 marks), which hurts mobile.
  - The textile metaphor is decorative rather than spatial.

### Scores (1 = poor, 5 = excellent)

| Criterion | A Orbital City | B Tidal City | C The Loom |
|---|---|---|---|
| Fidelity to the reference language (dial rotation, horizon ring, cards, stack, closing echo) | 5 | 4 | 3 |
| Analytical clarity (OD, concentration, congestion, scenario all legible) | 4 | 3 | 4 |
| Originality vs the other nine Data Frontier projects | 4 | 2 | 4 |
| Feasibility on static Pages at 60fps desktop / 30fps mobile | 4 | 5 | 4 |
| Data honesty (no implied paths, observed/simulated separable) | 5 | 3 | 4 |
| Mobile quality | 4 | 4 | 3 |
| Memorability | 5 | 3 | 4 |
| **Total (of 35)** | **31** | **24** | **26** |

**Why A gets originality 4, not 5.** Project 07 has "an oversized globe-limb arc with nodes travelling its circumference [that] flattens into the solved network map". Project 08 has "concentric population rings that settle onto the county map". Both are arc/ring-to-map transitions, so DESIGN_AUDIT would rightly flag a ring-to-map morph alone as shared. A's distinct elements are:

1. **Interior chords:** OD flows drawn *across* the ring's interior. No other project draws chords; 07 moves nodes *along* the circumference, and 08's rings are concentric bands.
2. **The morph is keyed by LocationID.** Every node lands on its own extruded polygon (263 identities preserved), where 07 flattens into an abstract network and 08 settles points.
3. **The dial anchors are places** (Manhattan, the airports, the hinge zone), not time. A has **no hour ticks anywhere on its circumference**, so it can never read as project 04's 24-hour clock. Rush hour is expressed as node *size*, with a mono readout off-ring.

DESIGN_AUDIT must check these three distinctions against 07 and 08 when they are designed.

### Selection: A, "Orbital City", with two grafts

A wins on fidelity, honesty and memorability, and it is the only concept where the core analytical object (the OD matrix) *is* the signature geometry. Two ideas from the losing concepts are grafted in because they improve A without diluting it:

- **From C:** the ring splits into two half-rings for S06 Futures. The left half is OBSERVED (solid light blue), the right half SIMULATED (dashed orange, hatched), with a 24px gap (the stretched-chord technique, ref 17). This gives the comparison scene a geometry of its own instead of a chart.
- **From B:** the horizon arc doubles as the observatory's time scrubber: 168 positions along the bottom arc, with no clock-face ticks. Tick marks appear only at day boundaries (7 ticks, labelled MON..SUN), so it reads as a week horizon, not a clock.

---

## 3. Experience blueprint (phase 16)

### 3.1 Chapter-to-scene map

| Scene | Directive chapter | Nav label | Track | Kind |
|---|---|---|---|---|
| S00 Opening | The City Awakens (intro) | (none, overlay) | 0 (fixed overlay, 4.6s or less) | Timed intro, skippable |
| S01 Big Idea | The City Awakens | CITY | 200vh | Scrubbed blur reveal, ring zooms to horizon |
| S02 Origin of the Data | Anatomy of a Journey | ANATOMY | 300vh | Story-card deck |
| S03a Mechanism I | The Rush Hour | RUSH HOUR | 200vh | Ring orbit, scrubbed hour |
| S03b Mechanism II | Invisible Corridors | CORRIDORS | 300vh | Ring horizon dial, 4 threshold steps |
| S04 Transformation | Where Demand Concentrates | DEMAND | 300vh | Ring-to-map morph, extrusion, clusters |
| S05 Experiment | A City Under Pressure | PRESSURE | 250vh | Observed pressure, then a live BPR lab |
| S06 Consequences | Alternative Futures | FUTURES | 200vh | Split-ring comparison |
| S07 Evidence | (methodology) | EVIDENCE | 250vh | Argument card stack |
| OBS | The Urban Intelligence Observatory | OBSERVATORY | 100dvh, **not pinned**, normal flow | Free exploration |
| S08 Conclusion | (closing, echoes S00) | (none; reached by scroll; the nav shows CITY..OBSERVATORY) | 200vh | Horizon rises, final blur reveal |

Total is about 2,300vh: about 23 viewports, against the reference's 14.4. The extra length is the analytical content. If the QA scroll recording shows fatigue, the first cuts are S03a to 150vh and S07 to 200vh.

**Why OBS comes after Evidence.** The visitor explores with the caveats already in mind, and the Conclusion still closes the loop with the opening ring. OBS is a normal-flow section: scrolling passes straight through it unless the visitor enters EXPLORE mode (see S-OBS), so it cannot trap scroll.

### 3.2 Global layout constants

- **Viewports:**
  - D = 1440x900 desktop
  - T = 768x1024 tablet
  - M = 390x844 mobile
- **Gutter:** `--gutter`, which is 32px on D, 19px on T and 16px on M.
- **Grid:**
  - D: 12 columns, gutter 32, side margins 96px.
  - T: 8 columns, margins 48px.
  - M: 4 columns, margins 16px.
- **Nav:** a bottom bar, 12px from the bottom (D only). On T and M, the MENU pill (bottom centre, 160x32) plus SKIP INTRO / REPLAY at the bottom right (13px mono).
- **Safe zone:** nothing interactive sits within 64px of the bottom on D, or 72px on T/M (nav).
- **Ring render:** Canvas2D, one viewport-sized canvas (`position: fixed` within the sticky stage). Geometry is drawn from (centre, radius, rotation) parameters, never by scaling a bitmap. Node marks are squares (the reference uses square points).
- **Ring order:** zones are ordered clockwise from 12 o'clock by borough: Manhattan, Bronx, Queens, Brooklyn, Staten Island, EWR. Within each borough, by the clockwise polar angle of the centroid around that borough's centroid, measured from north. There is a 1.5 degree gap between boroughs, so each zone gets (360 - 6 x 1.5) / 263 = 1.3346 degrees. The order is deterministic and precomputed (data request DR-1).

### 3.3 Ring states (exact geometry)

c = centre in CSS px from the top-left of the viewport, r = radius, top = c.y - r.

| State | D 1440x900 | T 768x1024 | M 390x844 | Node mark | Chords |
|---|---|---|---|---|---|
| R0 Orbit (intro end, S01 start) | c (720, 450), r 360 | c (384, 430), r 300 | c (195, 330), r 160 | D 4px, T 3px, M 2px squares, white 70% | Top 600 OD pairs (`od_matrix_totals`), light blue, alpha 0.06..0.5 by log trips, width 0.5..2px |
| R0c Rush orbit (S03a) | c (860, 470), r 380 (text left, x 96..516) | c (384, 600), r 300 (text above, y 72..260) | c (195, 470), r 168 (text above, y 56..230) | Square side = 2 + 10 x sqrt(trips_h / max_h) px (D), x 0.8 (T), x 0.5 (M) | Top 300 pairs of the current hour band (`od_top`), alpha 0.35 |
| R1 Horizon dial (S01 end, S03b) | r = 82vw = 1181, top 450 (50dvh), c (720, 1631). Visible arc 75.1 degrees (about 56 zones) | r = 82vw = 630, top 471 (46dvh), c (384, 1101). Visible arc 75.1 degrees | r = 130vw = 507, top 439 (52dvh), c (195, 946). Visible arc 45.2 degrees (about 34 zones) | 6px squares (D/T), 5px (M); anchor marker 16px square with a dotted vertical tick 1px, 120px tall (M: 72px) | Anchor's top 40 destinations, bezier control point at 0.35 of the way from chord midpoint to ring centre |
| R2 Split (S06) | Two half-rings, each r 340, c (700, 470) and (740, 470): left half (180..360 degrees) and right half (0..180 degrees) separated by 40px; text top-left | Each r 280, c (374, 560) and (394, 560) | Rotated 90 degrees: top half-ring OBSERVED c (195, 420) and bottom half-ring SIMULATED c (195, 444), r 160 | Node radial offset outward = 40px x (TTI - 1) | none (comparison is radial, not chords) |
| R3 Closing horizon (S08) | r 1181, rises from top 1080 (off-screen) to top 700; Spectral rim glow 48px | r 630, top 1024 rising to 760 | r 507, top 844 rising to 640 | nodes off; rim only, then the single echo pulse | one chord (the busiest pair) at the echo |

- **Arc span.** The visible span at the viewport edge is 2 x asin((vw / 2) / r). D/T: 2 x asin(0.6097) = 75.1 degrees. M: 2 x asin(195 / 507) = 45.2 degrees.
- **Mobile gets a deliberately *larger* relative ring** (130vw radius instead of 82vw), mirroring the reference's mobile, where "the arc is relatively larger". The result is fewer, bigger nodes, and destination tickets move to a list.

**Destination tickets (R1).** A chord that leaves the viewport gets a 13px mono ticket where it exits the bottom edge, at y = vh - 96 (D), clamped 16px from the sides:

- The ticket reads `→ {zone name} · {trips}`, plus an OBSERVED chip on the first ticket only.
- The top 6 are labelled on D, the top 4 on T. On M, tickets are a 3-row list card at y 640-760.
- Tickets collide-avoid with a 1D greedy pass, at a minimum 8px gap.

### 3.4 Scenes

Each scene lists: track, compositions (D/T/M), data, insight, honesty tags, interactions, transition out, and states.

**Shared state UI (all data-backed scenes):**

- **Loading:** the ring skeleton (a 1px circle at 16% white in the scene's ring state) plus a mono line, `LOADING OD_TOP.JSON · 42%`. The percentage is real (fetch stream bytes / Content-Length; if the length is unknown it says `LOADING OD_TOP.JSON` with no %).
- **Error:** `COULD NOT LOAD OD_TOP.JSON (HTTP 404)` plus a `RETRY` square button that re-runs the same fetch. Scrolling stays free.
- **Empty:** the scene-specific copy given below.
- **Ready:** normal render.
- **Reset:** scene-specific, given below.

There is never a spinner and never an artificial delay.

#### S00 Opening: The City Awakens (overlay, 4.6s or less)

- **Composition.** Pure black. Timeline (details in MOTION_SYSTEM.md):
  1. One busiest-pair signal.
  2. Chords ignite in geographic position.
  3. Nodes gather into ring R0.
  4. The ring dims to 30%.
  5. The headline sharpens over it.
  6. The nav enters.
- **Composition per viewport:**
  - D: headline centred, 2 lines at 96px, over R0.
  - T: 2-3 lines at 64px over R0.
  - M: ring R0 at the top half (c 195, 330), with the headline *below* the ring at y 560-700, 40px, 3 lines. It is not overlaid, for legibility at small size.
- **Wordmark (original, not the reference's spread wordmark).** A 13px mono line top-left, `ATLAS OF HUMAN MOBILITY`. Top-right is a mono time code that counts `00:00` to `23:59` across the intro, labelled `AN AVERAGE WEEKDAY` (the ignition order follows the hour-of-week curve).
- **LCP rule.** The headline element is in the DOM from first paint as blurred ghost text (opacity 0.32, blur 12px), never at opacity 0. See MOTION_SYSTEM.md section 2.
- **Data:**
  - `od_matrix_totals.json` (o, d, trips): the top 600 pairs, and the first signal = argmax trips.
  - `zones_index.json` (DR-1): centroid lon/lat, ring_index.
  - `zone_hour_week.json` (weekday hour totals, summed over zones) for the ignition schedule.
- **Insight.** Every line is a real corridor, and they add up to a system.
- **Tags.** On the end state (bottom-left, 13px), the chip DERIVED with the note `LINES = TOP 600 ZONE-TO-ZONE CORRIDORS, 2024. NOT ROUTES.`
- **Interactions.**
  - SKIP INTRO (bottom right, visible from 0ms, also the Esc key) jumps to the end state.
  - Any wheel, touch or keyboard scroll also completes the intro (in 350ms) instead of blocking.
  - The intro plays once per session (`sessionStorage`, wrapped in try/catch). REPLAY INTRO lives in the S08 closing and on the nav's right end.
- **Transition to S01.** None needed: the S00 end state *is* the S01 initial state.
- **States.** If the data is not ready by 1.2s, the intro runs on the geometry alone: the ring and nodes come from `zones_index.json`, which is small, and the chords fade in when `od_matrix_totals` arrives. If `zones_index.json` fails, the intro is replaced by the static headline on black plus RETRY.

#### S01 Big Idea: The City Awakens (200vh)

- **Composition.** The progress p is split into three phases:

| p | Change |
|---|---|
| 0-0.4 | The headline ("Millions of journeys...") scales from 96px to 44px and moves to y 120 (D). Meanwhile the ring interpolates **R0 to R1** (scrubbed): the radius goes 360 to 1181 and the centre y goes 450 to 1631, so the camera pushes into the system until it becomes a horizon. The chords fade to 0 (horizon state shows the arc and nodes only). |
| 0.35-0.75 | Statement 2 blur-reveals at 104px (D), 64px (T) and 40px (M), centred above the arc: "Every ride begins in one of 263 zones and ends in another." |
| 0.6-1 | Two notification cards type in. D: top-right, 360px wide, 24px apart. T: top, full width minus 48. M: full width minus 32, stacked at the top. |

- **Notification cards** (`#161616`, radius 8, padding 24, mono 13px header at 50%, 18px body):
  1. `FROM: ZONE {{facts.busiest_zone_id}} · {{facts.busiest_zone_name}} / {{facts.busiest_how_label}}`, with the body `{{facts.busiest_zone_peak_mean_trips}} PICKUPS IN AN AVERAGE HOUR LIKE THIS ONE.`
  2. A light-blue card with black text, `FROM: ALL 263 ZONES / EVERY MINUTE OF 2024`, with the body `{{facts.trips_per_minute_mean}} RIDES BEGAN, ON AVERAGE.`
- **Per viewport:**
  - T: the arc top sits at 471, statement 2 above it at y 220-400.
  - M: the arc top sits at 439 (R1 mobile), statement 2 at y 220-400 at 40px over 3-4 lines, and the cards stack above it, compressed to one-line bodies.
- **Data:** `zone_hour_week.json` (argmax over zone x how of the summed services) and `reconciliation.json` (kept totals).
- **Insight.** The scale (trips per minute) and the unit of analysis (the zone).
- **Tags.** Card 1 OBSERVED (a mean of observed counts). Card 2 DERIVED (total / 527,040 minutes in 2024).
- **Interactions.** None beyond scroll. The cards are not buttons.
- **Transition to S02.** The ring stays at R1 but fades to 20% opacity, a dim horizon under the cards.
- **States.** The statement is static text, so it needs no data. If the cards' data is missing, the cards don't render (no placeholder cards).

#### S02 Origin of the Data: Anatomy of a Journey (300vh)

- **Composition.** A horizontal story deck driven by vertical scroll:
  - D: cards 360x620 in a row with an 8px gap. The active card is centred at x 720, and the row translates left.
  - T: cards 320x600, centred, with neighbours peeking 24px.
  - M: cards 300x560, centred, with neighbours peeking 12px at the edges.
- **Card anatomy.** Radius 8, padding 24. Contents in order: chip (`ANATOMY 0n · ...`), a 4-segment progress bar (4px, 50% white, active white, current fills via linear scaleX), the serif title (40px D, 32px T, 28px M), a visual zone, a mono body (18px D, 15px T, 14px M) and the honesty tag at the bottom-left.
- **The four cards:**

| # | Fill | Visual zone | Data | Tag |
|---|---|---|---|---|
| 1 "A journey, as the city records it." | `#161616` with an inner Electric orb (cached canvas, 240px) | Below the orb, a mono field list: `PU_ZONE · DO_ZONE · PICKUP_TS · DROPOFF_TS · DISTANCE_MI · DURATION_S` with each row lighting in sequence | `DATA_CONTRACTS.md` unified trip schema (static) | OBSERVED |
| 2 "Three fleets, one ledger." | `#192CE4` fill, white text | A 3-segment proportional strip (yellow / green / FHVHV): white, 50% white and light-blue segments with mono % labels | `reconciliation.json` kept by service | OBSERVED |
| 3 "{{facts.excluded_total}} rows didn't make it." | `#161616` | A cleaning ledger: one row per exclusion reason (mono label, count right-aligned in tabular numerals, a 1px bar). The bottom rule shows `RAW = KEPT + EXCLUDED ✓` in light blue | `reconciliation.json` | OBSERVED (the counts) |
| 4 "A zone, not a street." | `#58B8E1` fill, black text, black 1px 45-degree hatch at 12px pitch (top-right quadrant only) | A 263-square micro-grid in black; squares of suppressed-heavy zones are hollow | `zones.geojson` count, `reconciliation.json` suppressed totals | OBSERVED |

- **Data:** `reconciliation.json`, `meta.json` (pipeline version shown in card 3's footer: `PIPELINE v{{meta.pipeline_version}} · GENERATED {{meta.generated_at}}`).
- **Insight.** What a "trip" is, how much was removed and why, and what the data cannot tell you.
- **Interactions.**
  - Cards are not buttons.
  - The progress segments are a `role="tablist"` (tabbable). Arrow keys jump the scroll to that card's progress band (instant, then the card settles over 800ms).
- **Transition to S03a.** The last card slides off left while the ring rises from the dim horizon back to the R0c orbit (centre lerp, radius 1181 to 380 on D). That is the camera pulling back, scrubbed over the final 15% of the track.
- **States.** If the reconciliation is missing, cards 2 and 3 show `LEDGER UNAVAILABLE` with RETRY, while cards 1 and 4 still render. Empty is not applicable.

#### S03a Mechanism I: The Rush Hour (200vh)

- **Composition.**
  - **D:** ring R0c on the right (c 860, 470). Left column x 96-516:
    - the serif statement (64px), "The city inhales at {{facts.am_peak_hour_label}} and exhales at {{facts.pm_peak_hour_label}}."
    - below it, a mono body (18px)
    - a WEEKDAY / WEEKEND segmented control (two square items, white active block, as in the nav)
    - a SERVICE control: ALL / YELLOW / GREEN / APP
  - **Inside the ring centre:** a mono readout, 56px tabular, `08:00`, with `AVERAGE WEEKDAY` (13px) below it and the citywide pickups in that hour: `{{hour_total}} PICKUPS / HOUR`.
  - **No ticks on the circumference** (the anti-clock rule).
- **T:** text block on top (y 72-260), ring below (c 384, 600). The controls sit in a row under the text.
- **M:**
  - The statement (36px) sits at the top.
  - The ring (c 195, 470, r 168) holds a 32px readout.
  - The controls become a single bottom row above the MENU pill: WKDAY | WKEND and a SERVICE chip that opens an upward list (same component as the nav menu).
- **Behaviour.**
  - Scroll p 0.1-0.9 scrubs hours 0..23 of the chosen day type, using a continuous interpolation between hourly values (so the visual eases between hours). The readout snaps to whole hours.
  - Node square size follows trips at the current hour.
  - Chords show the top 300 pairs of the hour band containing the current hour (`od_top.json`). `od_top` has no day-type or service split, so **chords respond to the hour band only**. A persistent 13px label under the readout says `CHORDS: ALL DAYS · ALL SERVICES · {{band_label}}`.
  - At the AM and PM peak hours, an orange pulse wave travels clockwise around the ring once (600ms). Motion-only.
- **Data:** `zone_hour_week.json` (zone, how, service: mean trips) and `od_top.json` (band, o, d, trips). WEEKDAY = mean over how of Mon-Fri at hour h; WEEKEND = Sat-Sun.
- **Insight.** Demand has two peaks on weekdays, and the weekend keeps a different clock. Size growth concentrates in Manhattan's arc at peaks.
- **Tags.**
  - Nodes and readout: OBSERVED (means of observed counts).
  - Chords: OBSERVED (band OD counts).
  - Pulse wave: no tag (motion-only, it carries no value).
- **Interactions.** Day type (2 values) and service (4 values) are visitor-set parameters. Changing either animates **node sizes and the readout only** (600ms, keyed by LocationID). The chords don't change on these toggles, because their data has no such split, and the label says so. Chords re-key only when the scrubbed hour crosses into a new band (fade-out 200ms, fade-in 350ms for chords not in both sets; chords in both sets tween alpha).
- **Transition to S03b.** At p 0.9-1 the radius grows from 380 to 1181 and the centre moves to R1, so the camera pushes into the horizon again. Chords collapse to 0.
- **States.**
  - Service = GREEN can produce hours where many zones are 0: nodes shrink to a 1px outline (hollow), never disappear, so the ring keeps its shape.
  - Empty readout copy: `NO GREEN-CAB PICKUPS RECORDED IN THIS HOUR` (if the citywide total is 0).

#### S03b Mechanism II: Invisible Corridors (300vh, 4 stepped states)

- **Composition (D).**
  - Ring R1, horizon at y 450.
  - The anchor's arc segment is rotated to 12 o'clock, with a 16px marker at the top and a dotted tick (120px tall) crossing it.
  - The anchor title (serif 44px) sits *above* the marker, centred at y 330-380. It is the reference's position, but our title is a place name.
  - The statement and body sit in the left column (x 96-516, y 120-400).
  - The chord fan descends from the anchor into the ring interior.
  - Destination tickets sit along the bottom (y 804), 6 maximum.
  - Right column (x 1100-1344, y 120-300): a mono "corridor ledger" of the top 5 corridors, with `MEDIAN {{min}} MIN · P10-P90 {{p10}}-{{p90}}` per row (`od_top`, all-hours band aggregate, request DR-5).
- **T:**
  - The anchor title sits above the arc (y 380).
  - The statement and body go at the top (y 72-300).
  - The ledger becomes a 3-row block above the tickets (y 760-900).
  - Tickets: 4.
- **M:**
  - Ring R1-M (top 439).
  - The anchor title (28px) sits above the marker.
  - The statement (32px) is at the top, y 56-200.
  - No side ledger. The tickets list card (y 640-760) *is* the ledger, with 3 rows: name, trips, median minutes.
- **The four states** (threshold-stepped at p = 0.0, 0.25, 0.5, 0.75; each step rotates the ring so the next anchor is at 12 o'clock, 1.2s):

| State | Anchor | Marker | Chord set | Claim to verify before build |
|---|---|---|---|---|
| 1 | Manhattan (the whole borough arc centred) | `#58B8E1` | Top 40 pairs with o in Manhattan | `facts.mn_internal_share_pct` is at least 50, else use the fallback title "Manhattan's corridors" |
| 2 | Airports (JFK 132 + LaGuardia 138, their mid-angle) | `#192CE4` with a white outline | Top 40 pairs with o in {132, 138} | none (descriptive) |
| 3 | Brooklyn | `#690DE2` with a white outline | Top 40 pairs with o in Brooklyn | `facts.bk_internal_share_pct` is at least 50, else the fallback "Brooklyn's corridors" |
| 4 | The hinge (argmax weighted betweenness, `network.json`) | white | That zone's top 40 in and out pairs | none (computed) |

- **Data:** `od_matrix_totals.json`, `network.json` (betweenness, pagerank), `od_top.json` (duration stats), `zones_index.json` (names, ring_index).
- **Insight.** Most corridors are short and local (short chords hugging the arc). The airports throw the longest chords. One zone holds the network together.
- **Tags.** Chords and ledger OBSERVED. Hinge zone DERIVED ("weighted betweenness on the 2024 OD graph").
- **Interactions.**
  - Visitor-set parameters: **click or tap any marker or node** on the visible arc to re-anchor the dial (it rotates to that zone or borough, 1.2s). The scroll-defined state is then marked as overridden, and scrolling into the next threshold resumes the authored sequence.
  - **HOUR BAND** chips (5 bands, `od_top` bands, labels from DR-4) re-key the chord fan and ledger.
  - Chords are hoverable on D: the hovered chord goes white at 2px and a custom tooltip card shows `ORIGIN → DESTINATION · TRIPS · MEDIAN MIN`.
  - Keyboard: Left/Right arrows step anchors when the ring is focused (`role="group"` with an `aria-label`).
- **Transition to S04.** At the end the ring pulls back from R1 to R0 (the first 30% of S04).
- **States.**
  - Empty: an anchor with no published corridor at the chosen band shows `NO PUBLISHED CORRIDORS FROM {{zone}} IN THIS BAND. CELLS UNDER 11 TRIPS ARE SUPPRESSED.`
  - Reset: a `RESET DIAL` text button appears only when overridden.

#### S04 Transformation: Where Demand Concentrates (300vh)

- **Composition.** Progress phases:

| p | What happens |
|---|---|
| 0-0.3 | The ring pulls back from R1 to R0 (scrubbed). |
| 0.3-0.65 | **The morph.** Each node travels from its ring position to its zone centroid projected through the target map viewport (pitch 0). Chords straighten to centroid-to-centroid lines. Staggered by borough (Manhattan first), each node's path is a straight lerp with `--ease-symmetric` applied per node over a 0.2-wide progress window. |
| 0.65 | Handoff: Canvas2D crossfades to deck.gl over 200ms, from identical geometry. |
| 0.65-0.85 | Polygons fade in (`#161616` fill, 1px `#58B8E1` at 35% stroke). The camera pitches from 0 to 50 degrees with bearing -18, and elevations grow from 0 to annual pickups (`zone_month` summed), with the top face light-blue-tinted by height. |
| 0.85-1 | Stepped state "CONCENTRATION": zones not in the top-N set that holds half of all pickups dim to 25%, and the statement swaps. |

- **Map composition:**
  - **D:** full-bleed map. The city is framed into the right 65% (deck viewport padding-left 520). Left column x 96-516: the statement, then a mono legend `HEIGHT = 2024 PICKUPS` with 3 reference heights labelled directly on 3 real zones (no gradient legend box).
  - **T:** the map in the lower 62% (y 390-1024), text at the top.
  - **M:**
    - The map is full-bleed with its centre offset up, so the city fits y 80-520 at zoom about 8.9 and pitch 40 (not 50, which keeps Staten Island visible).
    - The text sits in a bottom card (story-card anatomy, 100% - 32px wide, max 38% height) above the MENU pill.
- **CLUSTERS step (inside S04 at p 0.92, a second threshold).** Zones re-colour by cluster (k from `clusters.json`). The palette is built from the token families only: white, light blue, `#8fa2ff`, `#b48cff`, `#ffb547`. That is 5 at most, and with a larger k the extra clusters are merged into "other" with a note. Each cluster gets a direct label on its largest member zone (mono 13px), with a 7-day weekly-profile micro-line (168 points, 64x16px) beside it.
- **Data:** `zones.geojson` (lazy, fetched during S03), `zone_month.json`, `clusters.json` (centroid profile, members, silhouette, request DR-6 for labels), `zones_index.json`.
- **Insight.** Demand is extremely concentrated: `{{facts.zones_for_half_pickups}}` of 263 zones produce half of all pickups. Zones group into a few behavioural types by when they move.
- **Tags.** Heights OBSERVED. Clusters DERIVED (`K-MEANS, K={{clusters.k}}, SILHOUETTE {{clusters.silhouette}}`).
- **Interactions** (available from p of 0.85 or more):
  - Visitor-set **HEIGHT** metric: PICKUPS / DROPOFFS / NET (pickups minus dropoffs; negative = sink, drawn downward as a hollow outline, not below ground).
  - **Hover or tap a zone:** the contextual inspector (interaction 9).
  - Map pan/zoom is **disabled** in S04 (scroll must never be captured), and the camera is authored.
- **Transition to S05.** The camera pulls back (zoom -0.6), pitch 50 goes to 35, and the map dims to 35% to become the background of the lab.
- **States.**
  - Before `zones.geojson` arrives, the morph runs, but nodes land on centroids as squares and wait. A mono line `LOADING ZONE SHAPES · 61%` sits under the statement. If loading fails, the map stays a centroid map (square marks sized by pickups), with RETRY. That is a usable degraded state, not a blank.
  - If WebGL is unavailable: the Canvas2D centroid map (same encoding) plus the note `3D UNAVAILABLE ON THIS DEVICE`.

#### S05 Experiment: A City Under Pressure (250vh)

- **Composition.** Two phases:
  - **p 0-0.35, OBSERVED pressure.** The map (35%) re-colours zones by the speed ratio (observed median speed at the selected hour / the zone's overnight free-flow, DR-3), on a 5-step sequential scale (white = free-flowing to light blue = slowest). The statement reads "At {{facts.am_peak_hour_label}}, Manhattan moves at {{bpr.MN.peak_speed_ratio_pct}}% of its overnight speed."
  - **p 0.35 onward, the LAB** (the stage stays pinned until 1; the visitor may linger).
- **Lab composition (D):**
  - **Left column x 96-516.** The statement "Push the city." (serif 64px), then the controls (mono 13px labels, 18px values, tabular):
    - DEMAND x0.50 .. x1.50 (step 0.05)
    - CAPACITY -30% .. +20% (step 5)
    - BOROUGH (5 square chips)
    - HOUR (a 0-23 mini-scrubber plus a WKDAY/WKEND toggle)
    - RESET
  - **Right, x 600-1344 by y 120-640: the BPR stage.** It is not a chart box: there is no frame and no gridlines except 3 hairlines at 25% white.
    - x axis: volume / capacity (0..2.0), direct-labelled at its ends in mono.
    - y axis: travel-time index (1.0 .. max of 3.0 or the curve maximum).
    - Observed binned points: white 3px squares (DR-2).
    - The fitted curve: a 2px solid light-blue line, tagged DERIVED.
    - The **scenario curve**, when capacity is not 0: dashed orange.
    - The **operating point**: a 16px orange square (the dial marker motif) with a dotted vertical tick. It slides along the curve.
    - Behind it, a Solar orb (cached) whose scale = 0.6 + 0.4 x (TTI_sim - 1) and opacity = 0.15 + 0.35 x (TTI_sim - 1), clamped. That is the "pressure glow", inside the SIMULATED region only.
  - **Result line under the stage** (mono 24px tabular): `MEDIAN SPEED 11.8 → 9.6 MPH · A 18-MIN TRIP BECOMES 22 MIN`. Values are bound per section 6, and the *observed* value is white while the *simulated* value is orange plus underline-dashed.
  - **Persistent chip at the stage's top-left:** `SIMULATED · BPR VOLUME-DELAY, FITTED TO 2024`. A hatch band (12px tall) runs along the stage's top edge.
- **Lab composition (T).**
  - Statement at the top.
  - The BPR stage is full-width (y 260-640).
  - Controls in a 2-column block below (y 680-900).
  - The result line sits above the controls.
- **Lab composition (M).**
  - The BPR stage occupies y 64-380 (full width, 16px margins).
  - The result line sits at y 392-440 (2 lines, 16px).
  - The controls go in a **bottom sheet** (peek height 200px, showing DEMAND and CAPACITY sliders, each a full-width 44px-tall touch row). Drag or tap `MORE` to expand to 70% height for BOROUGH and HOUR.
  - The map background is hidden on M (GPU budget). The pressure glow remains.
- **Model.** Within the selected borough b and hour-of-week h:
  1. TTI(x) = 1 + alpha_b x x^beta_b, where x = v / c.
  2. Baseline x0 = v_bh / c_b (DR-2).
  3. Scenario x1 = (m x v_bh) / (c_b x (1 + dc)).
  4. Simulated speed = observed_speed_bh x TTI(x0) / TTI(x1).
  5. Simulated trip minutes = observed_median_minutes_bh x TTI(x1) / TTI(x0).

  At m = 1 and dc = 0 the ratio is exactly 1, so the observed values are reproduced exactly (a Vitest test asserts it). The computation runs synchronously on the main thread (5 boroughs x 168 hours is trivial).
- **Data:** `bpr_fit.json` (t0, alpha, beta, capacity index, diagnostics per borough), plus DR-2 (binned points, per borough x how baseline v, v/c, observed median speed, free-flow speed, median trip minutes).
- **Insight.** Speed collapses non-linearly. Near the curve's knee, a small demand increase costs far more time than the same decrease saves.
- **Tags.** The observed-pressure map is DERIVED (a ratio of observed medians). The fitted curve is DERIVED. Every scenario output is SIMULATED.
- **Interactions.** The four parameters above, all visitor-set. Arrow keys on sliders step by 1 increment, PageUp/Down by 4, Home/End go to the extremes. The output region is `aria-live="polite"`, debounced 400ms.
- **Transition to S06.** The BPR stage shrinks out: the curve collapses into the operating point, the point becomes the right half-ring's anchor node, and the ring enters as R2. The scene's scenario state carries into S06 as "YOUR FUTURE".
- **States.**
  - Loading: if `bpr_fit.json` is not loaded, controls are `disabled` (aria-disabled, 50% white) with `LOADING MODEL PARAMETERS`.
  - Error: RETRY.
  - Out-of-range warning: if x1 > the maximum observed x for that borough, the result line appends `BEYOND OBSERVED RANGE: EXTRAPOLATED` in `--state-warning` and the curve beyond x_max becomes dotted.
  - Empty: not applicable.
  - Reset: returns to m = 1, dc = 0, the borough with the highest PM volume, and h = the AM peak.

#### S06 Consequences: Alternative Futures (200vh)

- **Composition (D).**
  - R2 split ring at the centre. The left half, OBSERVED, has solid light-blue nodes at their base radius. The right half, SIMULATED, has each zone's node pushed outward by 40px x (TTI_sim - TTI_obs) along its radius, with a dashed orange stroke connecting the displaced nodes into an outline. The visible shape of the right half "swells" where the future is slower.
  - The statement sits top-left.
  - A **future selector** (bottom centre, above the nav) of 4 square items: A BUSIER YEAR (+15% demand) · A LANE LOST (-10% capacity) · A QUIETER CITY (-15% demand) · YOUR FUTURE (S05 values, disabled with a tooltip `SET IN PRESSURE` if untouched).
  - Right column x 1100-1344: a **borough delta list**. Five rows, keyed by borough, sorted by minutes added and re-sorted with a 600ms FLIP on change: `MANHATTAN +3.4 MIN`. The bars are orange, hatched and dashed-outlined (simulated). Values are signed.
- **Asymmetry callout (conditional).** If |delta(+15%)| > |delta(-15%)| citywide, a serif 32px line under the statement reads "Adding 15% costs more than removing 15% saves." The condition is computed at runtime. If false, the line is not shown.
- **T:** split ring at the top (y 200-760), selector below, delta list as a 5-row block under it.
- **M:** R2 rotated (top half OBSERVED, bottom half SIMULATED), the selector a horizontally scrollable square row (snap), and the delta list as a bottom card (5 rows, 14px).
- **Data.** The same model as S05, applied per zone: zone observed speed at the selected hour (`zone_hour_week` median speed) times the borough ratio. Plus `bpr_fit.json` and DR-2.
- **Insight.** Futures are asymmetric, and pressure lands on specific boroughs and hours.
- **Tags.** Left half OBSERVED. The right half, delta list and callout SIMULATED. The chip `SIMULATED · NOT A FORECAST · NO ROUTING OR MODE SHIFT` is persistent.
- **Interactions.**
  - Future selector (4 values) and HOUR (inherits S05; a compact WKDAY 08:00 chip opens the hour picker).
  - Hovering or tapping a node shows both values: `OBSERVED 12.1 MPH / SIMULATED 10.4 MPH`.
- **Transition to S07.** The two half-rings slide apart and fade, and the first objection card rises from below.
- **States.**
  - YOUR FUTURE is disabled until S05 is changed.
  - A model error shows RETRY.
  - Zones without a speed at that hour (no trips) render hollow and are excluded from the delta, with the note `{{n}} ZONES WITHOUT TRIPS AT THIS HOUR EXCLUDED`.

#### S07 Evidence: How We Know (250vh, 6 stepped exchanges)

- **Composition.** The argument stack, using reference mechanics (cards stack diagonally down-right, older cards dim to 35% and scale to 0.96, `all .35s ease-in-out`):
  - **D:** the stack is centred-left (x 360-980). Objection cards are `#292929` with the header `A SKEPTIC / NOW`. Answer cards are `#58B8E1` with black text and the header `THE PIPELINE / ALWAYS`. Answers can embed a mini-visual (max 460x160).
  - The right column holds a mono "receipt": artifact name, version and generated_at for the current answer's source.
  - **T:** stack full width minus 96. The receipt sits under the stack.
  - **M:** cards full width minus 32, stacked at the bottom of the viewport (the reference mobile pattern). Only the latest 2 cards are visible; the older ones collapse to 8px slivers.
- **The six exchanges.** Each is one threshold; the full copy is in section 5.
  1. "This is just taxis." Answer: the scope, and what's excluded.
  2. "Do the numbers add up?" Answer: the reconciliation equation with real totals and a mini ledger bar.
  3. "Those lines look like routes." Answer: there are no coordinates, and lines are centroid-to-centroid.
  4. "Does rain cause more rides?" Answer: the weather association coefficient with its CI. "Association, not cause." The mini-visual is a scatter of `daily.json` (366 points, PRCP vs trips) with the fitted line.
  5. "How good is the congestion curve?" Answer: BPR fit diagnostics per borough (R^2 or RMSE from `bpr_fit.json`).
  6. "Who gets hidden?" Answer: suppressed cells, and why (cells under 11 trips).
- **Data:** `reconciliation.json`, `weather_model.json`, `daily.json`, `bpr_fit.json`, `meta.json`.
- **Insight.** Trust is earned by stating limits, so every claim on the site is traceable.
- **Tags.** Each answer carries its own tag: 1 and 3 have none (they are scope statements), 2 and 6 OBSERVED, 4 DERIVED (association), 5 DERIVED.
- **Interactions.** The receipt's artifact names are links to the GitHub file (`target=_blank rel=noopener`). Tab cycles through the card links.
- **Transition to OBS.** The stack drops away. The map from S04 returns at full opacity as the observatory's base, and the horizon arc appears at the bottom as the time scrubber.
- **States.** A missing artifact for an answer shows `SOURCE UNAVAILABLE` plus RETRY inside that answer card.

#### OBS: The Urban Intelligence Observatory (100dvh, normal flow, not pinned)

- **Composition (D).**
  - Full-bleed deck.gl map (pitch 45, bearing -18).
  - **The horizon time scrubber** sits at the bottom:
    - an arc segment of a circle r 1400, top at y 760, spanning x 160-1280
    - 168 hour positions, with 7 day ticks (MON..SUN, mono 11px) only
    - the current hour marker is a **16px white square** with a dotted tick (white, not orange: the scrubber is an observed control)
    - a PLAY/PAUSE square button at its left end
    - the readout `WED 08:00` (mono 18px) above the marker
  - **Top-left:** the title `THE URBAN INTELLIGENCE OBSERVATORY` (mono 13px) plus a serif 44px line, "Explore any hour, any zone."
  - **Top-right: the control rail.** A vertical stack of square mono buttons in `--surface-glass` with blur 16:
    - LAYER: DEMAND / SPEED / CLUSTERS / NETWORK
    - SERVICE: ALL / YELLOW / GREEN / APP
    - VIEW: 2D / 3D
    - FLOWS: ON / OFF
    - COMPARE: OBSERVED / YOUR FUTURE
    - SCALE: CITY / BOROUGH / ZONE
  - **Region select:** a mono combobox `SEARCH 263 ZONES` plus 5 borough chips at the top centre.
  - **Inspector card** (story-card anatomy, 360x520): slides in from the right when a zone is selected.
  - **Readout strip** under the title: `FILTER: WED 08:00 · ALL SERVICES · QUEENS → {{n}} PICKUPS/HR` (the sum of the visible filtered zones).
- **T.** The map is the full stage. The control rail becomes a horizontal row at the top (scrollable, snap). The inspector is a bottom sheet (50% height). The scrubber arc is r 900, top at y 900.
- **M.**
  - The map fills y 0-560 (pitch capped at 40).
  - The scrubber arc is r 700, top at y 600, with a 44px touch band.
  - Controls: a single `LAYERS` square button opens a bottom sheet listing all controls in 44px rows.
  - The inspector is a bottom sheet (peek 160 / full 80%).
  - Flows are capped at the top 150 pairs.
- **Scroll safety.**
  - By default the map ignores the wheel and single-finger drag; hover and click still work on D.
  - An `EXPLORE` square button (or Enter on the focused map) enters EXPLORE mode: the map takes 100dvh, page scroll is locked (`overflow: hidden` on html), and dragPan and scrollZoom are enabled.
  - A visible `EXIT ✕` square (top-right) and Esc leave it.
  - On M, EXPLORE also enables single-finger pan. Outside EXPLORE, two-finger pinch only.
- **Cross-filter contract.** One store holds `{hourOfWeek, service, layer, region (borough | zone | null), selectedZone, view2D3D, flows, compare}`. The map, inspector, readout strip and scrubber all derive from it through pure selectors. The readout total equals the sum of the zone values rendered for the same filter, and the borough sums equal the citywide total (Vitest + Playwright assertion).
- **Layers:**
  - **DEMAND:** elevation = mean trips at the hour for the service.
  - **SPEED:** a 5-step colour scale on the speed ratio (DR-3), no elevation.
  - **CLUSTERS:** categorical colour (same as S04).
  - **NETWORK:** elevation = PageRank. Arcs for the selected zone's top 25 OD pairs in the current band.
  - **Flows (DERIVED):** pulses sampled from the `od_top` band containing the hour, using a seeded RNG (seed = band x 1000 + layer). Rate is proportional to trips, at most 600 pairs (D) or 150 (M). Flows ignore the SERVICE filter because `od_top` has no service split. The chip says `FLOWS: ALL SERVICES · HOUR BAND {{band_label}}`.
  - **COMPARE YOUR FUTURE:** zones get the hatch overlay (deck.gl FillStyleExtension pattern) and the SPEED layer uses the simulated ratio. It is disabled if S05 is untouched.
- **Camera moves:**
  - SCALE CITY / BOROUGH (the selected one, or the region chip) / ZONE (the selected zone) uses FlyToInterpolator, 1200ms.
  - Selecting a zone in the search flies to it.
  - 2D/3D toggles pitch 0 and 45 (800ms).
- **Inspector card.** Contents:
  - chip `ZONE {{id}} · {{borough}}`
  - the serif name
  - a 168-hour profile line (custom SVG, 312x64, white line, with the current hour as a white square marker)
  - the 4 metrics in mono tabular: mean pickups at hour, median speed and ratio, PageRank rank, cluster
  - top 5 destinations (name · trips · median min)
  - the tag row
- **Data:** all artifacts. `zones.geojson` is already loaded.
- **Insight.** Visitor-driven: any zone and hour, with honesty tags per layer.
- **Tags.** DEMAND and NETWORK heights OBSERVED/DERIVED (PageRank DERIVED). SPEED DERIVED. CLUSTERS DERIVED. Flows DERIVED. COMPARE SIMULATED. The tag of the current layer shows in the readout strip.
- **States.**
  - Empty: zone x hour x service with 0 trips shows `NO {{SERVICE}} PICKUPS IN {{zone}} AT {{WED 08:00}}`, and the zone draws as a hollow outline.
  - Loading: per-layer loading lines.
  - Error: per-layer RETRY.
  - Reset: a `RESET VIEW` square returns the store to its defaults (WED 08:00, ALL, DEMAND, no region, 3D, flows ON, OBSERVED, CITY).

> In OBS, every static marker is **white**, never orange, because OBS defaults to OBSERVED. This is binding: the engineer must not use orange for the scrubber or the inspector marker. Orange appears in OBS only as moving flow pulses, or as static marks while COMPARE = YOUR FUTURE (with hatch and chip).

#### S08 Conclusion (200vh)

- **Composition.**
  - p 0-0.5: the map flattens (pitch 45 to 0), zones fade to their outlines and then out.
  - The horizon ring R3 rises from below with the Spectral rim glow (layered canvas glow, cached).
  - A serif paragraph (D 44px, T 36px, M 28px) blur-reveals word by word: see the copy deck.
  - At p 0.75 **the echo**: the same busiest-pair signal from S00 travels once along a chord across the horizon (orange pulse, 1200ms), and the ring rim brightens for 600ms.
  - Then the links (mono 18px, `→`): `→ OPEN THE OBSERVATORY` (jumps up to OBS), `→ REPLAY THE INTRO`, `→ READ THE METHODOLOGY` (GitHub), `→ SOURCE CODE`.
  - Footer (12px mono, 50% white): sources, the `meta.generated_at` date and the author.
- **Per viewport:**
  - D: the paragraph sits left at x 96-940, y 220-420, with the links below.
  - T: the paragraph sits at the top, y 120-420.
  - M: the paragraph runs from y 96, with the links stacked at 44px rows.
  - R3 rises to its viewport-specific top (see 3.3).
- **Data:** `od_matrix_totals.json` (the echo pair) and `meta.json`.
- **Tags.** The echo pulse is DERIVED (`THE BUSIEST CORRIDOR OF 2024: {{o}} → {{d}}`, shown as a small caption under the paragraph after the echo).
- **States.** Static if the data is missing (the echo is skipped and the caption hidden).

---

## 4. Signature interactions

Ten interactions. Six are driven by visitor-set analytical parameters (marked P).

| # | Name | Category | P |
|---|---|---|---|
| 1 | The Awakening | Cinematic intro transformation | |
| 2 | Ring Breath | Scroll-driven geometric scene | P |
| 3 | Corridor Dial | Scroll-driven geometric scene (stepped) | P |
| 4 | Anatomy Deck | Animated story-card sequence | |
| 5 | Collapse into the City | Major data-driven visual transformation | P |
| 6 | Pressure Lab | User-controlled simulation | P |
| 7 | Split-Ring Futures | Significant interactive data viz (comparison) | P |
| 8 | The Observatory | Significant interactive data viz | P |
| 9 | Zone Inspector | Contextual inspection | |
| 10 | The Echo | Memorable closing | |

### 1. The Awakening (S00)

- **Inputs:** none (time), plus Skip, Esc and any scroll.
- **State:** `intro: 'playing' | 'done'`, `t` in ms.
- **Permitted values:** t 0..4600.
- **Data:** `od_matrix_totals` top 600, `zones_index`, weekday hourly totals.
- **Visual output:** one signal, then chords igniting in geographic position, then the nodes gather into R0, then the headline sharpens.
- **Keyboard:** Esc or Enter on SKIP finishes. Focus starts on SKIP INTRO.
- **Mobile/touch:** a tap on SKIP, or any touch-scroll, completes it in 350ms.
- **Reduced motion:** no timeline. The end state renders at once (R0 plus the sharp headline). The signal is not animated.
- **Text alternative:** a visually hidden paragraph: "Animated introduction: the 600 busiest zone-to-zone corridors of 2024 appear and gather into a ring of 263 taxi zones."
- **Test:**
  - Playwright: SKIP is visible at 100ms, and clicking it brings the nav into view within 400ms.
  - The LCP element = the headline (Lighthouse trace).
  - With reduced motion, the end state shows at the first screenshot.

### 2. Ring Breath (S03a) [P]

- **Inputs:** scroll progress, day type, service.
- **State:** `{hour: 0..23 (float while scrubbing), dayType, service}`.
- **Permitted values:** dayType WEEKDAY | WEEKEND. Service ALL | YELLOW | GREEN | APP.
- **Data:** `zone_hour_week` (mean trips: nodes and readout, which respond to all three inputs) and `od_top` (bands: chords, which respond to the hour band only).
- **Visual output:** node sizes and chords for the hour, plus the centre readout.
- **Keyboard:** the segmented controls are radio groups (arrow keys). When the ring is focused, Up/Down step the hour by scrolling the track to that hour's progress position.
- **Mobile:** bottom-row controls (44px). The service list opens upward.
- **Reduced motion:** the track becomes normal flow, showing 4 static frames (00:00, AM peak, 14:00, PM peak) side by side on D, 2x2 on T, stacked on M. The controls still work and redraw instantly.
- **Text alternative:** a visually hidden table of the hour and citywide pickups for the selected day type and service (24 rows), updated with the controls.
- **Test:**
  - Vitest: the readout total for (hour, service) equals the sum of the node values.
  - Playwright: switching to GREEN changes the readout and keeps 263 nodes in the DOM-mirrored a11y list.

### 3. Corridor Dial (S03b) [P]

- **Inputs:** scroll thresholds, a click/tap on a marker or node, hour-band chips, arrow keys.
- **State:** `{anchor: 'MN' | 'AIR' | 'BK' | 'HINGE' | zoneId | boroughId, band: 0..4, overridden: bool}`.
- **Permitted values:** any visible zone or borough, and 5 bands.
- **Data:** `od_matrix_totals`, `od_top`, `network`.
- **Visual output:** a 1.2s stepped rotation, the chord fan, tickets and the ledger.
- **Keyboard:** the ring is a group, Left/Right step the anchors, Enter on a focused ticket re-anchors to that destination.
- **Mobile:** tap a node (44px invisible hit circles); the list card is the ledger.
- **Reduced motion:** the rotation is instant (0ms), and the chords cross-fade at 0ms.
- **Text alternative:** the ledger is real text, a `<ol>` of the top 5 corridors with trips and median minutes.
- **Test:**
  - Playwright: scroll to the 0.6 progress of the track (inside state 3, clear of the 0.52 hysteresis edge); the anchor label is Brooklyn, and the angle has settled within 1.4s.
  - Rapid scroll across all 4 thresholds ends in state 4 with no intermediate stuck state.

### 4. Anatomy Deck (S02)

- **Inputs:** scroll, plus the progress-segment tabs.
- **State:** `activeCard 0..3`, `cardProgress 0..1`.
- **Permitted values:** activeCard 0, 1, 2, 3. cardProgress 0..1 (continuous, scrubbed).
- **Data:** `reconciliation`, `meta`.
- **Visual output:** the horizontal deck, the 4-segment progress, and the card visuals animating in (the ledger rows count up 600ms; values are set from data with no random intermediate values).
- **Keyboard:** a tablist (arrow keys).
- **Mobile:** the same sequence, with the cards 300px wide.
- **Reduced motion:** the deck becomes a vertical list of 4 cards in normal flow.
- **Text alternative:** the cards are real text.
- **Test:** Vitest: the ledger rows sum to raw minus kept, and the `RAW = KEPT + EXCLUDED` check renders only if the equation holds. Playwright: no card clips at 360x800.

### 5. Collapse into the City (S04) [P]

- **Inputs:** scroll progress, and the HEIGHT metric after landing.
- **State:** `{morphT 0..1, phase: 'ring' | 'morph' | 'map' | 'concentration' | 'clusters', heightMetric}`.
- **Permitted values:** heightMetric PICKUPS | DROPOFFS | NET.
- **Data:** `zones_index`, `zones.geojson`, `zone_month`, `clusters`.
- **Visual output:** 263 keyed nodes fly from the ring to their centroids, the polygons extrude, and the concentration dims the rest.
- **Keyboard:** the HEIGHT radio group. The map itself is not focus-trapping.
- **Mobile:** pitch 40, and the text sits in a bottom card.
- **Reduced motion:** the frames are ring, then map, then concentration, shown as 3 static steps (crossfade 0ms on thresholds).
- **Text alternative:** "Top 10 zones by 2024 pickups" as a visually hidden ordered list, plus the concentration sentence.
- **Test:**
  - Vitest: every ring node id has a geojson feature (263/263).
  - Playwright: at morph p = 1 the Canvas2D node screen positions are within 1px of `deck.project(centroid)`.

### 6. Pressure Lab (S05) [P]

- **Inputs:** demand m, capacity dc, borough, hour plus day type, and reset.
- **State:** `{m, dc, borough, how}`.
- **Permitted values:** m 0.50..1.50 step 0.05, dc -0.30..+0.20 step 0.05, 5 boroughs, 168 how.
- **Data:** `bpr_fit` and DR-2.
- **Visual output:** the operating point slides along the curve (600ms, `--ease-smooth`), the dashed scenario curve, the result numerals tween (600ms), and the pressure glow.
- **Keyboard:** native `<input type="range">` styled (arrow keys, PageUp/Down, Home/End). The chips are a radio group. RESET is a button.
- **Mobile:** a bottom sheet with 44px slider rows; a thumb drag updates live (throttled to rAF).
- **Reduced motion:** values update instantly, and the glow is static.
- **Text alternative:** the `aria-live` result sentence, "Simulated: median speed in Manhattan at Wednesday 08:00 falls from 11.8 to 9.6 mph."
- **Test:**
  - Vitest: m = 1 and dc = 0 gives the simulated speed equal to the observed one (exact), and the function is monotonic in m and in dc.
  - Playwright: drag DEMAND to 1.3; the result text changes, the chip SIMULATED is visible, and RESET restores the observed values.

### 7. Split-Ring Futures (S06) [P]

- **Inputs:** the future selector and the hour.
- **State:** `{future: 'BUSIER' | 'LANE' | 'QUIETER' | 'YOURS', how}`.
- **Permitted values:** future BUSIER (m 1.15, dc 0) | LANE (m 1.0, dc -0.10) | QUIETER (m 0.85, dc 0) | YOURS (the S05 m and dc, enabled only once S05 differs from 1.0 and 0). how 0..167.
- **Data:** `zone_hour_week` (speed), `bpr_fit`, DR-2.
- **Visual output:** the right half-ring swells per zone (600ms, keyed), and the borough list re-sorts (FLIP 600ms).
- **Keyboard:** a radio group, and nodes focusable through the list.
- **Mobile:** the rotated split and a snap row.
- **Reduced motion:** instant.
- **Text alternative:** a table of borough, observed minutes and simulated minutes.
- **Test:** Vitest: the borough deltas equal the trip-weighted mean of the zone deltas. Playwright: YOURS is disabled until the S05 slider moves.

### 8. The Observatory (OBS) [P]

- **Inputs:** scrubber or PLAY, layer, service, region, zone search, 2D/3D, flows, compare, scale, EXPLORE.
- **State:** the single store (see S-OBS).
- **Permitted values:**
  - how 0..167
  - layers 4, services 4
  - region 5 boroughs plus 263 zones plus null
  - view 2D | 3D, flows on | off, compare 2, scale 3
- **Data:** all artifacts.
- **Visual output:** keyed map transitions (elevation 800ms, colour 600ms), camera flyTo 1200ms, flows, the inspector.
- **Keyboard:**
  - The scrubber is a `role="slider"` (arrows ±1 hour, PageUp/Down ±24, Home/End).
  - Space toggles PLAY when the scrubber is focused.
  - The combobox follows the ARIA 1.2 pattern.
  - The map is reachable, and Enter enters EXPLORE.
- **Mobile:** the LAYERS bottom sheet and the arc scrubber with a 44px band. Playback runs at 2 hours per second (D runs at 4).
- **Reduced motion:** PLAY steps hourly without tweening. Camera moves are instant. Flows are replaced by static arcs (top 25 for the selected zone, or top 100 citywide).
- **Text alternative:** the readout strip plus the inspector are text, and a "Data table for this view" disclosure lists the top 20 zones for the filter.
- **Test:**
  - Playwright: set QUEENS, WED 08:00, GREEN. The readout equals the sum of the Queens zone values in the a11y table.
  - EXPLORE locks scroll, and Esc restores it (scrollY unchanged).

### 9. Zone Inspector (S03b nodes, S04, S06 nodes, OBS)

- **Inputs:** hover (D) or tap (T/M) on a zone or node, or search.
- **State:** `selectedZone` (in the shared store) and `hoverZone` (transient).
- **Permitted values:** selectedZone 1..263 (LocationID) or null. hoverZone 1..263 or null. Unknown codes 264/265 can never be selected (they have no geometry).
- **Data:** `zone_hour_week`, `od_matrix_totals`, `od_top`, `network`, `clusters`.
- **Visual output:**
  - Hover shows a compact custom tooltip (mono, `#161616`, radius 8, 200ms fade): name, pickups at the hour, tag.
  - Click opens the full inspector card (Motion layout, 600ms enter from the right, or a bottom sheet on T/M).
- **Keyboard:** Esc closes it, and focus returns to the invoking element. The card is a non-modal `role="dialog"` with a labelled heading.
- **Mobile:** tap opens the bottom sheet, and a swipe down closes it.
- **Reduced motion:** the card appears without slide (opacity 0ms).
- **Text alternative:** the inspector content is text, and the profile line has an `aria-label` summarising its peak hour and value.
- **Test:**
  - Playwright: click zone 161; the card heading matches `zones_index` and the top destinations are sorted descending.
  - axe: no serious issues with the card open.

### 10. The Echo (S08)

- **Inputs:** scroll threshold p 0.75, plus a REPLAY button.
- **State:** `echoPlayed: bool`.
- **Permitted values:** echoPlayed true | false (reset to false when progress falls below 0.73, the 0.75 threshold minus hysteresis).
- **Data:** the `od_matrix_totals` argmax.
- **Visual output:** the S00 signal crosses the horizon once, the rim brightens, and the caption appears.
- **Keyboard:** REPLAY THE INTRO is a button that scrolls to the top and replays S00.
- **Mobile:** the same.
- **Reduced motion:** a static chord with the caption.
- **Text alternative:** the caption names the corridor and its trips.
- **Test:** Playwright: scrolling to the S08 end makes the caption visible with the correct names. Reverse-scrolling above 0.75 and back does not duplicate the caption.

---

## 5. Copy deck

Rules:

- Serif statements use sentence case. (The reference capitalises every word; we deliberately don't. It is an originality choice and is easier to read.)
- Mono is uppercase.
- Numbers come only from placeholders (section 6).
- Claims marked (CHECK) must be verified against the artifact before build, and their fallback is used if the check fails.

### S00

- Headline: **"Millions of journeys. One living system."**
- Mono, top-left: `ATLAS OF HUMAN MOBILITY`. Top-right: `AN AVERAGE WEEKDAY · 00:00` (counting).
- End-state note (13px, 50% white): `LINES = THE 600 BUSIEST ZONE-TO-ZONE CORRIDORS OF 2024. NOT ROUTES.`
- Buttons: `SKIP INTRO`, `REPLAY INTRO`.

### S01

- Statement: **"Every ride begins in one of 263 zones and ends in another."**
- Card 1: header `FROM: ZONE {{facts.busiest_zone_id}} · {{facts.busiest_zone_name}} / {{facts.busiest_how_label}}`, body `{{facts.busiest_zone_peak_mean_trips}} PICKUPS IN AN AVERAGE HOUR LIKE THIS ONE.` Tag OBSERVED.
- Card 2: header `FROM: ALL 263 ZONES / EVERY MINUTE OF 2024`, body `{{facts.trips_per_minute_mean}} RIDES BEGAN, ON AVERAGE. {{facts.trips_kept_total}} IN ALL.` Tag DERIVED.

### S02 Anatomy of a Journey

1. Chip `ANATOMY 01 · THE ROW`.
   - Title: **"A journey, as the city records it."**
   - Body: `A PICKUP ZONE. A DROPOFF ZONE. TWO TIMESTAMPS. MILES AND SECONDS. THAT IS ALL THE CITY KNOWS ABOUT WHERE YOU WENT.`
   - Tag OBSERVED.
2. Chip `ANATOMY 02 · THREE FLEETS`.
   - Title: **"Three fleets, one ledger."**
   - Body: `APP-BASED RIDES (UBER, LYFT, VIA, JUNO): {{facts.share_fhvhv_pct}}%. YELLOW CABS: {{facts.share_yellow_pct}}%. GREEN CABS: {{facts.share_green_pct}}%. SAME ZONES, SAME CLOCK.`
   - Tag OBSERVED.
3. Chip `ANATOMY 03 · WHAT WE REMOVED`.
   - Title: **"{{facts.excluded_total}} rows didn't make it."**
   - Body: `TIMESTAMPS OUTSIDE THEIR MONTH. TRIPS THAT END BEFORE THEY BEGIN. ZERO MILES. FASTER THAN 80 MPH. EVERY EXCLUSION IS COUNTED, AND THE COUNTS ADD BACK TO THE RAW TOTAL.`
   - Footer `PIPELINE v{{meta.pipeline_version}}`.
   - Tag OBSERVED.
4. Chip `ANATOMY 04 · WHERE PRECISION ENDS`.
   - Title: **"A zone, not a street."**
   - Body: `NO COORDINATES. NO ROUTES. EVERY LINE ON THIS SITE JOINS TWO ZONE CENTERS. CORRIDORS WITH FEWER THAN 11 TRIPS ARE HIDDEN: {{facts.suppressed_cells_total}} OF THEM.`
   - Tag OBSERVED.

### S03a The Rush Hour

- Statement: **"The city inhales at {{facts.am_peak_hour_label}} and exhales at {{facts.pm_peak_hour_label}}."** (CHECK: both peaks exist in the weekday curve, defined as local maxima in 05-11 and 15-21. Fallback: "The city keeps two rush hours.")
- Body: `EACH SQUARE IS A ZONE. ITS SIZE IS THE AVERAGE NUMBER OF PICKUPS IN THAT HOUR. SCROLL TO MOVE THROUGH {{dayTypeLabel}}.`
- Weekend variant: statement **"Weekends keep a different clock."** with body `THE BUSIEST WEEKEND HOUR IS {{facts.weekend_peak_hour_label}}.`
- Readout: `{{hour}}:00` / `AVERAGE {{WEEKDAY|WEEKEND}}` / `{{hour_total}} PICKUPS / HOUR`.

### S03b Invisible Corridors

- Statement (left column, persistent): **"Draw every ride as a line, and the city's hidden corridors appear."**
- The four states (marker title, then body):
  1. **"Manhattan"**. `{{facts.mn_internal_share_pct}}% OF RIDES THAT START IN MANHATTAN END THERE. SHORT CHORDS, BARELY BENDING.` (CHECK: at least 50, else the body is `THE BUSIEST CORRIDORS START HERE: {{top_corridor}}.`)
  2. **"The airports"**. `JFK AND LAGUARDIA SEND RIDES TO {{facts.airport_dest_zone_count}} DIFFERENT ZONES. THE LONGEST CHORDS ON THE RING.`
  3. **"Brooklyn"**. `{{facts.bk_internal_share_pct}}% OF BROOKLYN PICKUPS NEVER LEAVE BROOKLYN.` (CHECK: at least 50, else `BROOKLYN'S BUSIEST CORRIDOR: {{top_corridor}}.`)
  4. **"{{facts.hinge_zone_name}}"**. `MORE SHORTEST PATHS THROUGH THE CITY'S TRIP NETWORK PASS THROUGH THIS ZONE THAN ANY OTHER. THE HINGE.` Tag DERIVED.
- Ledger header: `TOP CORRIDORS · {{band_label}}`. Row: `{{o}} → {{d}} · {{trips}} · MEDIAN {{min}} MIN (P10-P90 {{p10}}-{{p90}})`.

### S04 Where Demand Concentrates

- Statement 1: **"Flatten the ring and the city reappears."**
- Statement 2 (concentration): **"Half of all pickups come from {{facts.zones_for_half_pickups}} of 263 zones."**
- Statement 3 (clusters): **"{{clusters.k}} kinds of neighborhood, sorted by when they move."** Each cluster label comes from `clusters[i].label` (DR-6).
- Legend: `HEIGHT = 2024 PICKUPS` / `DROPOFFS` / `PICKUPS - DROPOFFS`.

### S05 A City Under Pressure

- Statement 1: **"At {{facts.am_peak_hour_label}}, Manhattan moves at {{bpr.MN.peak_speed_ratio_pct}}% of its overnight speed."**
- Statement 2 (lab): **"Push the city."**
- Control labels: `DEMAND`, `ROAD CAPACITY`, `BOROUGH`, `HOUR`, `RESET`.
- Result: `MEDIAN SPEED {{obs_speed}} → {{sim_speed}} MPH · A {{obs_min}}-MIN TRIP BECOMES {{sim_min}} MIN`.
- Chip: `SIMULATED · BPR VOLUME-DELAY CURVE, FITTED TO 2024 ZONE-HOUR SPEEDS`.
- Limitation line (13px, always visible): `NOT A TRAFFIC MODEL: NO ROAD NETWORK, NO ROUTING, NO CHANGE IN HOW PEOPLE TRAVEL. SPEED IS A PROXY FROM TRIP DISTANCE AND DURATION.`
- Extrapolation warning: `BEYOND THE OBSERVED RANGE: EXTRAPOLATED.`

### S06 Alternative Futures

- Statement: **"Three futures, one curve."**
- Futures: `A BUSIER YEAR · +15% DEMAND`, `A LANE LOST · -10% CAPACITY`, `A QUIETER CITY · -15% DEMAND`, `YOUR FUTURE · FROM THE LAB`.
- Conditional callout: **"Adding 15% costs more than removing 15% saves."** (shown only if computed true)
- Chip: `SIMULATED · NOT A FORECAST`.

### S07 Evidence (objection, then answer)

1. `THIS IS JUST TAXIS.` / `CORRECT. YELLOW, GREEN AND APP-BASED RIDES ONLY. NO SUBWAY, BUS, BIKE, WALKING OR PRIVATE CARS. "DEMAND" ON THIS SITE MEANS FOR-HIRE TRIP DEMAND.`
2. `DO THE NUMBERS ADD UP?` / `{{facts.raw_rows_total}} RAW ROWS = {{facts.trips_kept_total}} KEPT + {{facts.excluded_total}} EXCLUDED, BY REASON, PER FLEET AND MONTH. A TEST FAILS THE BUILD IF THEY DON'T.`
3. `THOSE LINES LOOK LIKE ROUTES.` / `THEY AREN'T. SINCE 2016 THE CITY PUBLISHES ZONES, NOT COORDINATES. EVERY LINE JOINS TWO ZONE CENTERS. MOVING PULSES ARE SAMPLED FROM ZONE-TO-ZONE COUNTS WITH A FIXED SEED.`
4. `DOES RAIN CHANGE HOW MANY RIDES THERE ARE?` / `WE CAN'T SAY "CAUSE". CONTROLLING FOR WEEKDAY AND MONTH, EACH 10 MM OF RAIN IS ASSOCIATED WITH A {{weather.prcp_effect_10mm_pct_signed}}% CHANGE IN DAILY RIDES (95% CI {{weather.ci_low_pct}}% TO {{weather.ci_high_pct}}%). ONE STATION, CENTRAL PARK. ASSOCIATION, NOT CAUSE.` (CHECK: if the CI spans 0, use the fallback `CONTROLLING FOR WEEKDAY AND MONTH, WE FIND NO CLEAR ASSOCIATION BETWEEN RAIN AND DAILY RIDES (95% CI {{weather.ci_low_pct}}% TO {{weather.ci_high_pct}}%). ONE STATION, CENTRAL PARK.`) The signed value is always rendered with its sign (+ or -).
5. `HOW GOOD IS THE CONGESTION CURVE?` / `FITTED PER BOROUGH ON OBSERVED ZONE-HOUR VOLUME AND SPEED. FIT ERROR (RMSE): {{bpr.<b>.rmse}}. AT 1.0x DEMAND IT REPRODUCES THE OBSERVED CITY EXACTLY, BY CONSTRUCTION.`
6. `WHO GETS HIDDEN?` / `ANY ZONE-TO-ZONE CELL WITH FEWER THAN 11 TRIPS: {{facts.suppressed_cells_total}} CELLS, {{facts.suppressed_trips_total}} TRIPS. THEY STAY IN THE TOTALS. THEY'RE ONLY REMOVED FROM THE CORRIDOR VIEWS.`

### OBS

- Title (mono): `THE URBAN INTELLIGENCE OBSERVATORY`.
- Line (serif): **"Explore any hour, any zone."**
- Hint (13px): `DRAG THE HORIZON TO MOVE THROUGH THE WEEK. SELECT A ZONE TO INSPECT IT. EXPLORE UNLOCKS PAN AND ZOOM.`

### S08 Conclusion

- Paragraph: **"A city is not only its streets. It is everyone deciding, every hour, to be somewhere else, and the lines those decisions draw."**
- Echo caption: `THE BUSIEST CORRIDOR OF 2024: {{facts.top_pair_o_name}} → {{facts.top_pair_d_name}} · {{facts.top_pair_trips}} RIDES.`
- Links: `→ OPEN THE OBSERVATORY`, `→ REPLAY THE INTRO`, `→ READ THE METHODOLOGY`, `→ SOURCE CODE`.
- Footer: `DATA: NYC TAXI AND LIMOUSINE COMMISSION TRIP RECORDS, 2024 · NOAA GHCN-DAILY, CENTRAL PARK · TLC MAKES NO REPRESENTATION AS TO THE ACCURACY OF THESE DATA · GENERATED {{meta.generated_at}} · RISHIT MATHUR`.

---

## 6. Placeholder bindings and data requests

### 6.1 Bindings (EXISTS = derivable today from a contracted artifact; DR = needs a data request)

| Placeholder | Source | Derivation | Status |
|---|---|---|---|
| `facts.trips_kept_total` | `reconciliation.json` | sum(kept) over service x month | EXISTS |
| `facts.raw_rows_total` | `reconciliation.json` | sum(raw rows) | EXISTS |
| `facts.excluded_total` | `reconciliation.json` | sum of each exclusion count (unknown-zone rows are kept, not excluded) | EXISTS |
| `facts.share_{fhvhv,yellow,green}_pct` | `reconciliation.json` | kept by service / total kept | EXISTS |
| `facts.trips_per_minute_mean` | `reconciliation.json` | trips_kept_total / 527,040 (2024 has 366 days) | EXISTS |
| `facts.busiest_zone_*`, `busiest_how_label` | `zone_hour_week.json` | argmax over (zone, how) of trips summed over services | EXISTS |
| `facts.am_peak_hour_label`, `pm_peak_hour_label` | `zone_hour_week.json` | citywide weekday hourly sums. argmax in 05-11, argmax in 15-21 | EXISTS |
| `facts.weekend_peak_hour_label` | `zone_hour_week.json` | argmax of the citywide Sat+Sun hourly mean | EXISTS |
| `facts.mn_internal_share_pct`, `bk_internal_share_pct` | **DR-8, computed from the pre-suppression interim trips** | sum(o in B, d in B) / sum(o in B) over all kept trips with known zones. These are aggregate shares, with no re-identification risk. Deriving them from post-suppression `od_matrix_totals` would bias them, so the site must not do that | DR |
| `facts.airport_dest_zone_count` | **DR-8, pre-suppression** | count of distinct d (1..263) with at least 1 trip from o in {132, 138}. The post-suppression count would be systematically understated | DR |
| `facts.hinge_zone_name` | `network.json` + zones | argmax betweenness | EXISTS |
| `facts.zones_for_half_pickups` | `zone_month.json` | sort zones by annual pickups and count to 50% | EXISTS |
| `facts.top_pair_*` | `od_matrix_totals.json` | argmax trips | EXISTS |
| `facts.suppressed_cells_total`, `suppressed_trips_total` | `reconciliation.json` | suppressed-cell totals (trip count needed: DR-7) | PARTIAL |
| `clusters.k`, `clusters.silhouette` | `clusters.json` | direct | EXISTS |
| `clusters[i].label` | `clusters.json` | **DR-6** | DR |
| `bpr.MN.peak_speed_ratio_pct` | DR-3 | speed at the AM peak / free-flow | DR |
| `obs_speed`, `obs_min`, v/c baseline | DR-2 | per borough x how | DR |
| `bpr.<b>.rmse` | `bpr_fit.json` diagnostics | needs the named field (DR-2) | PARTIAL |
| `weather.prcp_effect_10mm_pct_signed`, `ci_low_pct`, `ci_high_pct` | `weather_model.json` | coefficient on PRCP (per mm) and its 95% CI. If the spec is log(trips), effect = (exp(10 x b) - 1) x 100, applied to the CI bounds the same way. If linear, effect = 10 x b / mean daily trips x 100 | EXISTS (needs the field names and the spec) |
| `meta.pipeline_version`, `meta.generated_at` | `meta.json` | direct | EXISTS |

**Recommendation.** The data agent computes all `facts.*` in Python into `facts.json` (DR-8), with pytest assertions. The site then has one source for every headline number and does no business logic in TS beyond the live model. If DR-8 is declined, the site computes the EXISTS rows in a single `facts.ts` module with a Vitest parity test against the Python values.

### 6.2 Data requests (not in `DATA_CONTRACTS.md` today)

| ID | Request | Why the design needs it | Size |
|---|---|---|---|
| DR-1 | `zones_index.json`: LocationID, name, borough, centroid lon/lat, `ring_index` (0..262, the ordering rule in 3.2), `ring_angle_deg` | The intro and ring scenes must not wait for the full `zones.geojson`, and ring order must be deterministic and tested in one place | about 20 KB |
| DR-2 | Extend `bpr_fit.json` to **borough grain** (resolve "borough (or cluster)"). Per borough: `t0, alpha, beta, capacity_index, rmse, r2, n, x_max_observed`, plus `binned_points: [{x: v/c, tti, n}]` (at most 40 bins), plus `baseline[168]: {v, x, median_speed_mph, median_trip_min}` | S05/S06 operating point, observed scatter, extrapolation warning, and the minutes-added output. Without the baseline v/c the lab cannot place the operating point | about 60 KB |
| DR-3 | Per zone x how: `speed_ratio` = median speed / the zone's free-flow speed (free-flow definition fixed in Python, e.g. the median speed over 02:00-05:00 across all days), plus per-borough `free_flow_mph`. Either as a field in `zone_hour_week.json` or a new `congestion.json` | S05 observed-pressure map, the OBS SPEED layer, the S05 statement. The definition must live in tested Python, not TS | about 180 KB raw, or reuse `zone_hour_week` |
| DR-4 | The `od_top.json` hour-band definitions (`bands: [{id, label, hours: [..]}]`), in `meta.json` or the file header | Band chips and labels in S03b and OBS flows | tiny |
| DR-5 | An "all hours" aggregate of `od_top` duration stats per OD (median, p10, p90 minutes), or confirmation that `od_matrix_totals` can carry median duration | The S03b ledger's MEDIAN and P10-P90 for the all-band default | small |
| DR-6 | `clusters[i].label` (a 2-3 word human name, assigned from the centroid profile by a documented rule, e.g. "Weekday commuter core", "Late-night", "Airport") | Direct cluster labels in S04 and OBS. Labels must not be invented in the frontend | tiny |
| DR-7 | `suppressed_trips_total` alongside the suppressed-cell totals in `reconciliation.json` | S07 answer 6 | tiny |
| DR-8 | `facts.json`: every `facts.*` row in 6.1, computed and tested in Python. The borough-internal shares and the airport destination count **must** come from the pre-suppression interim data | One source of truth for copy numbers, without suppression bias | about 3 KB |
| DR-9 | A size budget for `zones.geojson`: at most 400 KB raw (about 120 KB gzip) after simplification, with the simplification tolerance recorded in `meta.json` | The LCP and performance budget (lazy, but on the S04 critical path) | n/a |
| DR-10 | `zone_hour_week.json` delivered as columnar arrays (zone x how x service as typed arrays in JSON or a small binary) rather than an array of objects, if it exceeds 300 KB gzip | Parse time on mobile | n/a |
| DR-11 | `od_ring_top.json`: the top 600 OD pairs by annual trips (o, d, trips) as a separate small file, sorted descending | S00, S01 and S03b must not download the full `od_matrix_totals.json` (up to about 69k pairs) on the critical path | about 12 KB |

---

## 7. Hard rejection criteria

I fail the build on review if any of these is true:

1. **Any section reads as a dashboard.** That means a KPI tile row, a card grid of metrics, a sidebar of filters, a framed chart panel with gridlines and a default legend, or a kepler-style left panel. OBS fails if its controls form a fixed sidebar instead of the floating rail and arc scrubber.
2. **Orange appears as a static mark in an OBSERVED context** (marker, fill, legend, bar, scrubber, inspector marker), or SIMULATED content lacks any of its three non-colour cues (dashes, hatch, persistent chip).
3. **A line, pulse or animation implies a street route or an individual trajectory.** Pulses must travel centroid-to-centroid chords and carry the DERIVED sampling label in view.
4. **Any number on screen is not bound to a named artifact field** (section 6), or a (CHECK) claim ships without its check.
5. The **S05 model at 1.0x and 0% does not reproduce the observed values exactly**, or a "simulating..." indicator appears with no real asynchronous work behind it.
6. The ring shows **hour ticks** around its circumference (a clock face), or the S03b dial is scrubbed instead of threshold-stepped with a 1.2s settle.
7. **The headline LCP is later than 2.5s** in the Lighthouse trace, or the hero text starts at opacity 0.
8. **Any pinned scene traps the visitor:** reverse or rapid scroll stalls, a nav jump lands on a broken intermediate state, the map captures wheel or touch outside EXPLORE, or reduced motion leaves a pinned track.
9. **Mobile is a reflow of desktop.** The ring geometry, ticket list, bottom sheets and S06 rotated split must be visibly different compositions in the 390x844 screenshots, and T must differ from both.
10. The **morph is not keyed:** nodes cross-fade or teleport instead of travelling to their own centroid, or the Canvas2D-to-deck handoff jumps by more than 1px.
11. Two consecutive scenes look the same in the contact sheet (the SIGNALROOM failure). Every scene must have its own composition at a glance.
12. **A control does nothing** or changes unrelated values. RETRY doesn't re-run the fetch, RESET doesn't restore defaults, or YOUR FUTURE is enabled without lab input.
13. **Text contrast fails:** blue `#192CE4` or purple `#690DE2` used as text, 50% white used under 13px, or a dial marker without its outline when filled blue or purple.
14. Any reference asset is used: Blink fonts, wordmark styling (a full-width spread mono wordmark), copy, images or video.
15. **No visible tag** on a data visual, or a weather statement without "association, not cause".
16. **The closing doesn't echo the opening** (the same busiest-pair signal on the same ring language).
17. A U+2014 or U+2015 dash appears in the site copy.
