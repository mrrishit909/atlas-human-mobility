# Architecture

Two halves joined by a contract: an offline Python pipeline that turns raw TLC files into small JSON artifacts, and a static browser site that only reads those artifacts.

```
data/raw (gitignored)           pipelines/ingestion/fetch.py   (checksums -> data/manifests/raw_manifest.json)
   -> data/interim (gitignored)         pipelines/cleaning/clean.py    (DuckDB; exclusion ledger -> data/manifests/cleaning_ledger.json)
   -> data/processed (gitignored)       pipelines/modeling/{zones,aggregate,ring}.py
   -> site/public/data/*.json (tracked) pipelines/publish.py  (+ analytics/*)  suppression K<11 applied here
   -> data/contracts/*.schema.json      pipelines/contracts.py  (draft 2020-12)
   -> docs/METHODOLOGY.md               analytics/exploration/eda.py
```

Entry point: `pipelines/run_all.py` (`--fetch`, `--force`); step runtimes are written to `data/manifests/runtime.json`.

## Pipeline and analytics

- `pipelines/common.py`: shared paths (raw, interim, processed, public, contracts, manifests).
- `pipelines/cleaning/clean.py`: first-failing-rule exclusion so `raw = kept + sum(exclusions)` per service-month; unknown zones kept in totals but out of spatial analytics.
- `pipelines/modeling/`: `zones.py` (TLC shapefile to simplified WGS84 GeoJSON), `aggregate.py` (zone x hour-of-week, zone x month, OD, daily), `ring.py` (ring ordering for the site).
- `analytics/`: `data.py` loaders, `congestion.py` (speed ratio vs zone free flow), `network.py` (PageRank, betweenness), `clustering.py` (k-means on L1-normalized weekly shape), `weather.py` (OLS with HAC errors), `bpr.py` (scenario model, SIMULATED), `evaluation/validate.py` (baselines, holdout, seeds).
- `pipelines/publish.py`: writes every artifact with `schema_version`, per-field `tags`, and suppression counts.

## Data contract

17 schemas in `data/contracts/` cover 16 JSON artifacts and `zones.geojson` in `site/public/data/`. `tests/test_contracts.py` validates each artifact, enforces the 6 MB total and 400 KB `zones.geojson` budgets, and checks the dash-character rule. Full field descriptions: `docs/DATA_CONTRACTS.md`. `bpr_test_vectors.json` lets the TypeScript BPR in `site/src/data/bpr.ts` be tested against the Python one (`site/src/data/bpr.test.ts`).

## Site (`site/`)

Vite 8, React 18, TypeScript 6 strict, Tailwind CSS v4, Lenis smooth scroll, deck.gl 9 for the map. Base path `/atlas-human-mobility/` (`site/vite.config.ts`). Static output, no server.

| Area | Files | Role |
|---|---|---|
| Shell | `src/main.tsx`, `src/app/{App,scenes,useIntro,ErrorBoundary}.tsx` | Scene registry (`scenes.ts`: ids, track heights, landing points), intro (S00), error boundary |
| Data layer | `src/data/{loader,types,derive,copy,bpr,useArtifact}.ts` | Typed artifact loader with initial/loading/ready/empty/error/retry states and real byte progress; derived models (ring, anchors, bands); copy deck; client BPR |
| Scroll | `src/scroll/{engine,hooks,Track}.tsx` | Tracks register their section; progress is computed once per frame and pushed to subscribers without React renders |
| Motion | `src/motion/{loop,ease,tween,progress,reveal,useTweened}.ts` | One rAF loop for the whole page; easing, tweens, stepped progress |
| Ring graphics | `src/graphics/{ring,canvas,orb}.ts`, `src/scenes/director.ts` | One Canvas2D ring object carried S00 to S04; the director computes its state from (scene, progress, time) |
| Map | `src/scenes/{MapStage.tsx,deckMap.ts,mapView.ts,mapStyle.ts}` | deck.gl layers for the S04 morph, extrusion, clusters and the OBS arcs |
| State | `src/state/{atlas,lab,motion,obs}.ts` | Shared scene parameters (external store), BPR lab inputs, reduced-motion switch, observatory selection |
| Scenes | `src/scenes/S01City` ... `S08Closing`, `Observatory`, `Inspector` | See the table below |
| Components | `src/components/` | WordReveal, Nav, StoryCard/Deck, Orb, HonestyChip, Tooltip, StateUI, CountUp, NotificationCard |
| Styles | `src/styles/{tokens,app,scenes,gallery}.css` | Design tokens and scene CSS |

### Scene map (per `docs/VISUAL_DESIGN.md` 3.1; code as of this commit)

| Scene | Name | Code | Status in code |
|---|---|---|---|
| S00 | Opening (intro overlay) | `app/useIntro.ts`, `scenes/RingStage.tsx` | present |
| S01 | The City Awakens | `scenes/S01City.tsx` | present |
| S02 | Anatomy of a Journey | `scenes/S02Anatomy.tsx` | present |
| S03a | The Rush Hour | `scenes/S03aRush.tsx` | present |
| S03b | Invisible Corridors | `scenes/S03bCorridors.tsx` | present |
| S04 | Where Demand Concentrates | `scenes/S04Demand.tsx` | present |
| S05 | A City Under Pressure (BPR lab) | `scenes/S05Pressure.tsx` | present (committed e8d1f40; further edits may be in progress) |
| S06 | Alternative Futures | `scenes/S06Futures.tsx` | present (committed e8d1f40; further edits may be in progress) |
| S07 | How We Know | `scenes/S07Evidence.tsx` | present (committed e8d1f40; further edits may be in progress) |
| Observatory | Urban intelligence observatory | `scenes/Observatory.tsx` | present |
| S08 | Closing | `scenes/S08Closing.tsx` | present |

Visual and motion specifications live in `docs/VISUAL_DESIGN.md` and `docs/MOTION_SYSTEM.md`; this document does not repeat them. Lighthouse, axe and frame-pacing results for the final build: pending QA.

## Key decisions

- Precompute everything; the browser never sees raw trips and never claims live inference. SIMULATED output is labeled where shown.
- One rAF loop and one fixed ring canvas for S00 to S04 so scene seams agree by construction.
- Scenes degrade: static ring (`StaticRing.tsx`) and reduced-motion paths, state UI for failed loads.
- Dev-only component gallery (`Gallery.tsx`, `npm run build:gallery`); not part of the production bundle.
