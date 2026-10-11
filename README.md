# Atlas of Human Mobility

An art-directed scroll story and observatory for 281.3 million for-hire trips in New York City, 2024 (yellow taxi, green taxi and high-volume FHV). A single "ring of zones" carries the visitor from an opening orbit through the rush hour and hidden corridors, morphs into a map, then opens a live scenario lab, observed-versus-simulated futures and a plain account of how we know.

Live site (placeholder until deployed): https://mrrishit909.github.io/atlas-human-mobility/

Part of The Data Frontier program (project 01). Status of each phase: `docs/BUILD_STATUS.md`.

## What is in the repo

| Path | What |
|---|---|
| `pipelines/` | Offline pipeline: ingestion, cleaning, zone and aggregate modeling, artifact publishing, JSON Schema generation. Entry point `pipelines/run_all.py` |
| `analytics/` | Congestion indicator, network, clustering, weather regression, BPR scenario model, independent validation, EDA |
| `data/contracts/` | 17 JSON Schemas (one per published artifact) |
| `data/manifests/` | Raw file manifest with checksums, cleaning ledger, step runtimes |
| `site/` | Vite + React 18 + TypeScript static site (Canvas2D ring, deck.gl map, Lenis scroll) |
| `site/public/data/` | The published, precomputed artifacts the site loads (the site never computes from raw data) |
| `tests/` | pytest: cleaning, reconciliation, schema contracts, models, data quality |
| `docs/` | Design and engineering documents (see below) |

## Reproduce

Requires Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 24 (the build machine runs v24.21.0), and about 11 GB free disk (6.1 GB raw TLC files plus 4.0 GB cleaned intermediates, as measured on the build machine).

```bash
# 1. Data pipeline: raw -> interim -> processed -> site/public/data/*.json -> docs/METHODOLOGY.md
uv run python -m pipelines.run_all --fetch     # --fetch downloads raw data once; later runs skip it
uv run pytest -q                               # add -m "not slow" to skip the raw re-count

# 2. Site
cd site
npm ci
npm run typecheck && npm run lint && npm test
npm run build && npm run preview               # http://localhost:4301/atlas-human-mobility/
npm run e2e                                    # Playwright against the production build
```

The published artifacts are committed, so step 2 works without step 1.

## Honesty tags

Every number on the site carries one of these tags, visible in the UI.

| Tag | Meaning |
|---|---|
| OBSERVED | Counted from the source data |
| DERIVED | Computed from observed data (shares, indices, clusters, network measures) |
| PREDICTED | Model output for data we have (held-out fits) |
| SIMULATED | Scenario output from the BPR model. Never presented as measured traffic |
| SYNTHETIC | Generated stand-in data. This project publishes none; the tag exists for the program |

## Documents

`docs/`: PROBLEM, DATA_SOURCES, DATA_CONTRACTS, METHODOLOGY, VISUAL_DESIGN, MOTION_SYSTEM, BUILD_STATUS, ARCHITECTURE, TESTING, LIMITATIONS, DEPLOYMENT.

## Credits and licenses

- Trip data: NYC Taxi and Limousine Commission (TLC) trip records. TLC did not create the data and makes no representation about accuracy. This is an independent project, not affiliated with or endorsed by the TLC.
- Weather: NOAA NCEI GHCN-Daily, station USW00094728 (Central Park). US Government work.
- Fonts, both self-hosted through `@fontsource-variable` with no runtime font requests (decision record: `~/data-frontier/design/fonts/DECISION.md`): Newsreader (display, SIL OFL 1.1, Production Type) and JetBrains Mono (interface and data, SIL OFL 1.1, JetBrains). The visual system is inspired by a reference site; none of its fonts, logos, images or code are used.
- Code: author's own work; no license file has been added yet (open question).
