# Build status: 01 Atlas of Human Mobility

| Phase | Status | Evidence |
|---|---|---|
| 01 Workspace recon | PASSED | New project; no prior repo. `~/data-frontier/MASTER_PLAN.md` Context |
| 02 Problem | PASSED | docs/PROBLEM.md |
| 03 Dataset research | PASSED | docs/DATA_SOURCES.md (HTTP-verified URLs, sizes, terms) |
| 04 Data contracts | PASSED (to re-verify against downloaded schemas) | docs/DATA_CONTRACTS.md |
| 05 Ingestion | PASSED | pipelines/ingestion/fetch.py; data/manifests/raw_manifest.json has 36 trip files + zones + weather (39 entries), re-run skips all |
| 06 Cleaning | PASSED | pipelines/cleaning/clean.py; data/manifests/cleaning_ledger.json (raw = kept + exclusions, exact, 36 service-months); tests/test_cleaning.py, tests/test_reconciliation.py |
| 07 Data modeling | PASSED | pipelines/modeling/{zones,aggregate,ring}.py; site/public/data/zones.geojson (263 zones, no duplicate IDs in the shapefile); data/processed/*.parquet |
| 08 Data quality tests | PASSED | tests/ (pytest): schema, nulls, keys, referential integrity, ranges, reconciliation, DST bucketing, coordinate transform; slow test re-counts raw and interim Parquet |
| 09 EDA | PASSED | analytics/exploration/eda.py -> docs/METHODOLOGY.md sections 2-3 |
| 10 Analytical model design | PASSED | docs/METHODOLOGY.md section 4 (bands, free flow, network, clustering, weather, BPR identifiability) |
| 11 Analytics engine | PASSED | analytics/{data,congestion,network,clustering,weather,bpr}.py, pipelines/publish.py; site/public/data/*.json |
| 12 Independent validation | PASSED (with reported weak spots) | analytics/evaluation/validate.py -> site/public/data/validation.json; BPR holdout beats both constant baselines, R^2 moderate (0.16-0.79); clustering k=3 silhouette 0.333 vs random <= 0.006 |
| 13 Artifact contracts | PASSED | data/contracts/*.schema.json (17), tests/test_contracts.py, site/public/data/bpr_test_vectors.json; entrypoint `uv run python -m pipelines.run_all` |
| 14-30 | NOT_STARTED | |
| 18 Frontend scaffold (Stage A) | READY FOR REVIEW (orchestrator visual QA pending) | site/ Vite + React 18 + TS strict + Tailwind v4 + Lenis; one rAF loop (src/motion/loop.ts), scroll engine, typed loader with real states; `npm run typecheck`, `lint`, `test` (38 Vitest), `e2e` (11 Playwright on vite preview incl. axe) all green |
| 19 Shared visual/motion primitives (Stage A) | READY FOR REVIEW (orchestrator visual QA pending) | WordReveal, nav bar + MENU pill, StoryCard deck, Orb, Canvas2D ring (R0/R1, stepped dial), notification card, honesty chips, tooltip, state UI; dev gallery `?gallery`; evidence artifacts/evidence/stage-a/ (1440x900, 768x1024, 390x844 + contact sheets) |
