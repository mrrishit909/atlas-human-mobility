# Data sources, provenance and licensing

Verified 2026-10-10 (HTTP HEAD + download; checksums in `data/manifests/raw_manifest.json`).

| Source | Publisher | Coverage used | Format / size | Terms | Tag |
|---|---|---|---|---|---|
| Yellow taxi trip records | NYC TLC (via nyc.gov, CloudFront) | 2024-01..12 | Parquet, about 50-62 MB/month | Public NYC data. TLC: "The trip data was not created by the TLC, and TLC makes no representations as to the accuracy of these data." | OBSERVED |
| Green taxi trip records | NYC TLC | 2024-01..12 | Parquet, about 1.3 MB/month | Same | OBSERVED |
| High-volume FHV (Uber, Lyft, Via, Juno) trip records | NYC TLC | 2024-01..12 | Parquet, about 470 MB/month | Same. TLC "cannot guarantee or confirm their accuracy or completeness" | OBSERVED |
| Taxi zone shapefile + lookup | NYC TLC | 263 zones + 2 unknown codes (264, 265) | zip 1.0 MB, CSV | Same | OBSERVED |
| GHCN-Daily USW00094728 (Central Park) | NOAA NCEI | 2024 daily | CSV 17.8 MB (whole station history) | US Government work, no use restrictions | OBSERVED |

## Candidates evaluated and not used
| Candidate | Why not |
|---|---|
| Non-high-volume FHV (`fhv_tripdata`) | Large share of null PU/DO zones and small volume. Adds noise without changing the picture; noted as a limitation |
| MTA GTFS / subway ridership | Different unit (station entries vs trips) with no OD at zone level. Mixing them would invent a fusion we can't validate. Possible future work |
| OpenStreetMap road network | Would allow true link-level congestion but requires map-matching of trips we don't have coordinates for. Out of scope, honestly |
| Citi Bike | Already covered by an existing portfolio project (citibike-demand). Kept as future work |

## Known quality issues to handle (from TLC user guide and dictionaries)
- Timestamps outside the file's month and year, negative or zero durations, extreme durations (over 6h).
- Zero or negative distance, and implausible speeds (over 80 mph).
- Unknown zones 264/265 (and 0/null in some feeds).
- Yellow/green `trip_distance` is meter-reported. HVFHV `trip_miles` and `trip_time` are platform-reported.
- DST: 2024-03-10 (spring, the 02:00 hour is missing) and 2024-11-03 (fall, the 01:00 hour repeats). Timestamps are naive local time.
