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
