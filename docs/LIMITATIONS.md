# Limitations

Collected from `docs/METHODOLOGY.md`, `docs/DATA_SOURCES.md` and the frontend build. Figures are from `site/public/data/facts.json`.

## Data

- **TLC disclaimer.** The trip data was not created by the TLC; the TLC makes no representation as to its accuracy or completeness. This project is independent and not endorsed by the TLC.
- **For-hire trips only.** Yellow, green and high-volume FHV. No subway, bus, bike or private car, so "demand" means for-hire trip demand, not all movement. Non-high-volume FHV was evaluated and not used.
- **Zone-level, not routes.** The data has TLC zone IDs (263 zones), no coordinates and no trajectories. Ring chords and map arcs connect zone pairs; they are not paths driven. The site draws lines between zones and never claims routes.
- **High-volume FHV dominates.** 85.4% of the 280,236,580 kept trips are HVFHV, 14.3% yellow, 0.2% green. The patterns are mostly the platforms' patterns. Platform-reported `trip_miles` and `trip_time` cannot be verified by the TLC.
- **Speed is a proxy.** Derived from reported distance and timestamp difference, conditioned on the trip-distance mix (airport trips run 21.6 mph against 11.7 mph citywide), not measured road speed.
- **Cleaning.** 1,063,806 rows (0.38%) excluded by six ordered rules; yellow loses 2.33% and green 6.81%. If failures correlate with congestion, speeds are biased; not testable here. Unknown zones (264, 265, 0, null) stay in totals but are out of spatial analytics (4.18% of HVFHV trips touch one).
- **Small-cell suppression.** Cells with 1 to 10 trips are null in every published count (K < 11). 25,018 trips in OD pairs under 11 annual trips are withheld from the OD totals; 100,516 cells are suppressed across artifacts (overlapping, not additive). Headline shares are computed before suppression, which `facts.json` states in its `provenance` field.
- **Daylight saving.** Timestamps are naive wall clock. The repeated 01:00 hour on 2024-11-03 cannot be separated, so the Sunday 01:00 hour-of-week mean is inflated by about 1/52 (1.9%). The busiest zone-hour of week (East Village, Sun 1 AM) sits in that cell.
- **One year, one station.** 2024 only; weather is one station (Central Park) applied citywide; no seasonality beyond one cycle.
- **Selection.** Only completed, recorded trips exist; unserved demand is invisible. Zone aggregates say nothing about individuals (ecological fallacy).

## Models

- **Weather is association, not causation.** About +2.00% daily trips per 10 mm rain (95% CI 1.15% to 2.86%, HAC(7)). Single station, no control for events or strikes. We do not claim a mechanism.
- **BPR scenarios are SIMULATED.** Alpha and beta are fitted to hour-of-week pairs where demand and speed both follow the clock, so the curve describes co-variation, not proof that added demand slows traffic by the same amount. Capacity C is fixed to the p95 hourly volume (a normalization, not engineered capacity). Fitted beta is near 1 (classic BPR uses 4), R^2 is moderate (0.50 to 0.79 borough, 0.16 to 0.46 zone-pooled train), and beta depends on the free-flow definition (Queens 1.98 to 2.57). Scenarios beyond observed v/C (max 1.05 to 1.22) are extrapolation and are flagged on the site. The model is not a policy or congestion-pricing simulator.
- **Clusters are coarse.** k = 3, silhouette 0.333 (weak structure), against 0.006 or less for random labels; ARI stability 0.966 mean. Labels come from a documented rule on centroids. Seven low-volume zones are excluded.
- **Network measures favour airports.** The highest-betweenness zone is LaGuardia; betweenness measures position in the flow graph, not physical routing.
- **Noisy small zones.** Median speed is masked below 30 trips per cell.

## Frontend and release (final, after independent QA pass 7)

Open minors accepted at release (none blocks; see `docs/QA_REPORT.md` Pass 7 register):

- **D-016, data budget.** Scene data is 887 KB gzipped against the 400 KB budget (`zone_hour_week.json` alone is 496 KB gz). It loads lazily per scene; measured Lighthouse (mobile LCP 1.8 s, perf 0.99) is inside the gate. deckMap ships without a source map.
- **D-027, S08 footer under the horizon.** At 1024 wide the echo chord crosses the footer credit, and at 360x800 the closing horizon stroke runs through two credit lines. The text stays readable.
- **D-062, 768x1024 with classic scrollbars.** On the S03b LaGuardia step the title touches the band row for about 1 s, then settles 13 px lower.
- **D-064, S04 metric switch.** For one frame (two in one case) after a click the legend names the new basis while three labels still show the old one.
- Polish: D-022, D-023, D-024, D-040 (see QA register).

Environment limits:

- Scroll storytelling is a long page (about 23 viewports by design).
- deck.gl needs WebGL. Frame pacing was measured on a laptop with software WebGL in headless Chromium, 4x CPU throttle for mobile; it is not a real phone.
- Playwright e2e is not run in CI (see `docs/TESTING.md`); QA ran it locally, 242 passed, 0 failed.
- No code licence file is included yet: the licence is a pending owner decision, so by default all rights are reserved. Data licences are in `docs/DATA_SOURCES.md`.
