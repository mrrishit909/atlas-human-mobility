# Testing

Every figure below comes from a command run on 2026-10-10 on the build machine (macOS, Python 3.13.12 via uv locally; CI pins 3.12). Items not yet run say `TBD (pending QA)`. The release rule applies: green tests are necessary, not sufficient; independent visual QA of real screenshots is still required.

## Python (`tests/`, pytest)

| Command | Result |
|---|---|
| `uv run pytest -q` (project root, full data present) | 50 passed, 1 warning (SingularMatrixWarning from `analytics/weather.py` in `test_holidays_and_weather_design`, an intentionally rank-deficient design check) |
| `uv run pytest -q -m "not slow"` in a fresh `git clone` (no raw or interim data, as in CI) | 49 passed, 1 deselected |
| `uv run pytest -q` in the same fresh clone | 1 failed, 49 passed. The failure is `test_reconciliation.py::test_interim_and_raw_counts_match_ledger` (marked `slow`), which re-counts `data/raw` and `data/interim` |

What the files cover: `test_cleaning.py` (synthetic Parquet through the real cleaner, DST and bucketing), `test_reconciliation.py` (raw = kept + exclusions, published totals reconcile; the slow test re-counts raw Parquet), `test_contracts.py` (each of the 17 schemas validates its artifact, size budgets, no dash characters), `test_models.py` (BPR beats both baselines on the Oct-Dec holdout, seeded determinism, weather design), `test_quality.py` (nulls, keys, ranges, referential integrity).

## Site (`site/`)

| Command | Result |
|---|---|
| `npm run typecheck` | clean (no errors) |
| `npm run lint` | clean (no errors) |
| `npm test` (Vitest 5) | 7 test files, 65 tests passed |
| `npm run e2e` (Playwright, desktop 1440x900 + mobile 390x844 projects, against `vite preview`) | TBD (pending QA). Not run for this document because it rebuilds `site/dist`, which the frontend work uses. The spec files `site/e2e/{shell,scenes,b2}.spec.ts` contain 25 `test(` calls (grep count); BUILD_STATUS reports earlier green runs |
| `npm run build` | TBD (pending QA) |

## Quality gates not yet measured

| Gate | Target | Result |
|---|---|---|
| Lighthouse performance (production build) | 90+ | TBD (pending QA) |
| Lighthouse accessibility | 95+ | TBD (pending QA) |
| LCP | 2.5 s or less | TBD (pending QA) |
| CLS | 0.1 or less | TBD (pending QA) |
| axe-core on every scene at 3 breakpoints | 0 violations | TBD (pending QA); axe is wired into the Playwright specs |
| Frame pacing (desktop ~60 fps, mobile ~30 fps+), device stated | per gate | TBD (pending QA) |
| Screenshots at 1440x900, 768x1024, 390x844 plus scroll recording | read by an independent QA pass | TBD (pending QA) for the final build; earlier stage evidence is in `artifacts/evidence/stage-a`, `stage-b1`, `stage-b2` |
| Public URL checked with curl and a real screenshot | HTTP 200 + screenshot | TBD (pending deploy) |

## CI

`.github/workflows/ci.yml` runs pytest (`-m "not slow"`) and the site typecheck, lint, Vitest and build. Playwright e2e is excluded from CI: it needs browser binaries and software WebGL (deck.gl) and was only ever verified locally, so including it would be unproven. Run it locally before every deploy.
