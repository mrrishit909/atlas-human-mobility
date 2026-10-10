# Problem definition: Atlas of Human Mobility

## Core question
How do people, the for-hire transport network, and the city's zones interact across space and time,
and how sensitive is that system to changes in demand and capacity?

## Target users and the decisions they make
| User | Decision the site supports |
|---|---|
| Transport planner / city analyst | Where and when for-hire demand concentrates; which zone pairs form the busiest corridors; where speeds collapse at peak |
| Mobility operator analyst | How demand shifts by hour, weekday and weather; how much the airport and Manhattan core dominate flows |
| Curious public / hiring reviewer | An honest, explorable picture of how 2024 NYC moved by taxi and app-based car |

## Analytical outputs
1. Zone x hour trip counts and an origin-destination (OD) matrix (263 x 263) for 2024. These reconcile exactly to the raw row counts after documented cleaning.
2. Temporal profiles: hour-of-week curves per zone and per service type; peak-hour identification.
3. Travel-time and speed distributions per corridor and hour band (median, p10, p90).
4. A congestion indicator: median trip speed (miles/hour) relative to the zone's own overnight free-flow speed.
5. Network analysis on the OD graph: weighted PageRank, strength and betweenness, plus corridor ranking.
6. Clustering of zones by normalized weekly demand profile (k-means, k chosen by silhouette, with stability checks).
7. Weather association: daily trips vs precipitation and temperature. This is a regression with day-of-week and month controls, labeled association, not cause.
8. Scenario explorer (SIMULATED): demand multipliers and capacity changes pushed through a BPR-style volume-delay curve, fitted to observed zone-hour (volume, speed) pairs.

## Success criteria
- Every number on the site traces to a pipeline artifact. Totals reconcile to source within the documented exclusions (a test asserts it).
- Time bucketing is deterministic (America/New_York local time, the pickup timestamp hour), and DST days are tested.
- Coordinate transforms (EPSG:2263 to WGS84) are tested against known zone centroids.
- The scenario explorer is visibly labeled SIMULATED and reproduces the observed state at multiplier 1.0.

## Limitations (known up front)
- Taxi and FHV trips are a subset of mobility. There is no subway, bus, bike, walking or private car, so "demand" here means for-hire trip demand.
- Location granularity is the taxi zone (263 areas). No coordinates exist after 2016, so there are no individual paths. Flow animations are sampled from aggregate OD counts, not real trajectories.
- HVFHV trip_miles and trip_time are reported by the platforms. TLC states it cannot guarantee their accuracy.
- Speed is derived from (distance / duration) of for-hire trips. It is a proxy for traffic conditions, not a road-network speed measurement.
- Weather comes from a single station (Central Park) and is applied citywide.

## Ethics
Only aggregate zone-level counts are published. Small cells (fewer than 11 trips in an OD x hour-band cell) are suppressed in published artifacts to avoid outlier re-identification of rare trips, and the suppression is reported. No attempt is made to infer individuals or trajectories.
