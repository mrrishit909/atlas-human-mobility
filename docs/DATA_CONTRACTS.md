# Data contracts

Grain, keys, units and rules. The pipeline enforces these in `tests/` (pytest) and they are mirrored in
TypeScript types for the site. Verified against the real 2024 Parquet schemas before modeling.

## Unified trip (interim, not published): `data/interim/trips_2024/service=*/month=*/*.parquet`
| Field | Type | Unit / semantics | Rule |
|---|---|---|---|
| service | enum {yellow, green, fhvhv} | source feed | not null |
| pickup_ts | timestamp (naive) | America/New_York wall clock as published | within 2024 and within the file's month (else excluded: `ts_out_of_month`) |
| dropoff_ts | timestamp | same | must be after pickup_ts (else `nonpositive_duration`) |
| pu_zone, do_zone | int16 | TLC LocationID | 1..263 for spatial analytics. 264/265/null go to `unknown_zone` (kept in totals, excluded from spatial and OD) |
| distance_mi | float32 | miles (yellow/green `trip_distance`, fhvhv `trip_miles`) | 0 < d <= 200 (else `bad_distance`) |
| duration_s | int32 | seconds (dropoff minus pickup; fhvhv cross-checked with `trip_time`) | 60 <= s <= 21600 (else `bad_duration`) |
| speed_mph | float32 | derived distance/duration | <= 80 (else `implausible_speed`) |
| hour_local | int8 | 0..23, pickup hour | deterministic |
| dow | int8 | 0=Mon..6=Sun | deterministic |
| date_local | date | pickup date | |

Every exclusion reason is counted per service x month in `data/manifests/cleaning_ledger.json`.
Raw rows = kept + the sum of each exclusion reason (tested exactly).

## Published artifacts: `site/public/data/` (all small; schema versioned `v1`)
| Artifact | Grain | Key | Contents |
|---|---|---|---|
| `zones.geojson` | zone | LocationID | simplified WGS84 polygons (EPSG:2263 to 4326), borough, name, centroid lon/lat |
| `zone_hour_week.json` | zone x hour-of-week (168) x service | (zone, how, service) | mean trips per hour-of-week, median speed |
| `zone_month.json` | zone x month | (zone, month) | trips by service (pickups and dropoffs) |
| `od_top.json` | OD pair x hour band (5 bands) | (o, d, band) | trips, median/p10/p90 duration and speed. Cells under 11 trips suppressed and counted |
| `od_matrix_totals.json` | OD pair (all hours) | (o, d) | annual trips (suppressed under 11) |
| `network.json` | zone | zone | PageRank, in/out strength, betweenness, cluster id |
| `clusters.json` | cluster | id | centroid weekly profile, members, silhouette |
| `daily.json` | date | date | trips by service, PRCP mm, TMAX/TMIN C, SNOW mm |
| `weather_model.json` | model | n/a | coefficients, CIs, R^2, n, spec (association only) |
| `bpr_fit.json` | borough (or cluster) | id | fitted t0, alpha, beta, capacity index, fit diagnostics |
| `reconciliation.json` | service x month | (service, month) | raw rows, kept, each exclusion count, unknown-zone count, suppressed-cell totals |
| `meta.json` | n/a | n/a | source manifest summary, pipeline version, generated_at, tags per artifact |

Units: trips are counts; speeds are mph; durations are seconds; precipitation is mm (GHCN tenths of mm / 10); temperature is degrees C (tenths / 10).

## Contract refinements from phases 05-13 (verified against the real 2024 data)

- **Exclusion reasons.** Evaluated in this order, one per row: `null_timestamp` (added), `ts_out_of_month`, `nonpositive_duration`, `bad_duration`, `bad_distance` (includes null/NaN distance), `implausible_speed`. Unknown zones (not in 1..263) stay in `kept` and are counted in `unknown_pu`, `unknown_do`, `unknown_od`. Ledger rows also carry `kept_known_od` and `trip_time_mismatch_gt60s` (FHV diagnostic, not an exclusion).
- **Interim.** `speed_mph` is computed from distance and duration; unknown zones keep their original code (or NULL).
- **Honesty tags.** Every artifact has `schema_version: "v1"` and `tags` (field group -> OBSERVED | DERIVED | PREDICTED | SIMULATED). JSON Schemas: `data/contracts/*.schema.json`, validated in `tests/test_contracts.py`.
- **Layouts.** Large artifacts are columnar: `zone_hour_week.json` (flat, index = zoneIndex*168 + how; services `all|yellow|green|fhvhv`; fields `mean_trips`, `speed_mph`, `speed_ratio` (all services), `free_flow_mph` per zone, `vref` per zone, `borough_free_flow_mph`), `zone_month.json` (index = zoneIndex*12 + month-1, `pickups`/`dropoffs` per service), `od_matrix_totals.json` (parallel arrays `o`,`d`,`trips`, pairs >= 11 trips, includes o == d). `zone_hour_week.json` is about 2.1 MB raw / 0.5 MB gzip.
- **Suppression.** Cells with 1..10 trips are `null`; zero stays 0. `reconciliation.json` has per-artifact `suppression` ({cells, trips}), `suppressed_cells_total`, and `suppressed_trips_total` (= trips in OD pairs withheld from `od_matrix_totals.json`; per-artifact figures overlap, do not add).
- **`od_top.json`.** Header `bands` ([{id,label,hours}], also in `meta.json`) and `columns`; rows are arrays `[o,d,band,trips,dur_p10_min,dur_p50_min,dur_p90_min,spd_p10,spd_p50,spd_p90,dist_mi]`. Directed corridors only (o != d). Top 300 per band; band id `all` (top 2000) carries the all-hours stats (DR-5).
- **New artifacts.** `zones_index.json` (DR-1, ring order rule in `pipelines/modeling/ring.py`), `od_ring_top.json` (DR-11, top 600 pairs o != d), `facts.json` (DR-8, headline numbers, pre-suppression where required), `validation.json`, `bpr_test_vectors.json`.
- **Clusters.** `clusters[i].label` assigned by the rule stored in `clusters.json.label_rule` (DR-6). k chosen by silhouette over 3..8 (real data: k = 3).
- **`weather_model.json`.** Spec is **log**: dependent variable is log(daily kept trips). Fields: `models.bins` and `models.continuous`, each `{spec, se, n, r2, adj_r2, dropped_days, coefficients:[{term, beta, se, ci_lo, ci_hi, p, pct_effect, pct_ci_lo, pct_ci_hi}]}`. `beta`/CI are on the log scale per unit of the term (`prcp_per_mm` per mm; `tmax_per10c` per 10 C); `pct_effect = exp(beta)-1` (a fraction, not percent). Headline `prcp_effect_10mm = {spec, pct, ci_low_pct, ci_high_pct}` is in percent with `pct = 100*(exp(10*beta_prcp_per_mm)-1)`.
- **`bpr_fit.json` (DR-2), borough grain.** Per borough: `t0_min_per_mile` (= 60/free_flow_mph), `free_flow_mph`, `alpha`, `beta`, `capacity_index` (C, trips/hour = p95 of the borough's 168 hourly volumes; alpha, beta and C are not jointly identifiable, so C is pinned and alpha is fitted), `rmse`, `r2`, `n` (168), `x_max_observed` (max v/C), `binned_points` (24 bins of {x, tti, n}), `baseline[168]` ({how, v, x = v/C, median_speed_mph, median_trip_min, tti, fitted_speed_mph}), `zone_level` (zone-pooled fit, in zone-relative units with C = the zone's `vref`), `holdout` (fit Jan-Sep, scored Oct-Dec). TTI = free_flow_mph / median_speed_mph.
- **Scenario functions** (`analytics/bpr.py`, parity vectors in `bpr_test_vectors.json`, relative tolerance 1e-9): `scenario_speed(obs, v, C, alpha, beta, dm, cm) = obs * ((1+alpha(v/C)^beta) / (1+alpha(v*dm/(C*cm))^beta))`; `scenario_fitted_speed(ff, v, C, alpha, beta, dm, cm) = ff / (1+alpha(v*dm/(C*cm))^beta)`. The anchored form returns exactly `obs` at dm = cm = 1.
- **Free-flow definition (DR-3).** Zone: p85 of the zone's hour-of-week median speeds over 02:00-05:59 (>= 14 cells with >= 30 trips each), all services. `speed_ratio = median speed / free flow`. Borough: same rule on borough medians.
- **Simplification.** `zones.geojson` tolerance 0.00008 degrees, recorded in `meta.json` (`zones_simplify_tolerance_deg`).
- **`meta.json.generated_at`** is the latest raw retrieval time, so reruns are byte-identical.
