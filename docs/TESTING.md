# Testing

Figures below come from commands run on 2026-10-10 and 2026-10-11 on the build machine (macOS, Python 3.13.12 via uv locally; CI pins 3.12). The release rule applies: green tests are necessary, not sufficient; independent visual QA of real screenshots is still required.

## Python (`tests/`, pytest)

| Command | Result |
|---|---|
| `uv run pytest -q` (project root, full data present) | 50 passed (49 with `-m "not slow"`, re-run at release), 1 warning (SingularMatrixWarning from `analytics/weather.py` in `test_holidays_and_weather_design`, an intentionally rank-deficient design check) |
| `uv run pytest -q -m "not slow"` in a fresh `git clone` (no raw or interim data, as in CI) | 49 passed, 1 deselected |
| `uv run pytest -q` in the same fresh clone | 1 failed, 49 passed. The failure is `test_reconciliation.py::test_interim_and_raw_counts_match_ledger` (marked `slow`), which re-counts `data/raw` and `data/interim` |

What the files cover: `test_cleaning.py` (synthetic Parquet through the real cleaner, DST and bucketing), `test_reconciliation.py` (raw = kept + exclusions, published totals reconcile; the slow test re-counts raw Parquet), `test_contracts.py` (each of the 17 schemas validates its artifact, size budgets, no dash characters), `test_models.py` (BPR beats both baselines on the Oct-Dec holdout, seeded determinism, weather design), `test_quality.py` (nulls, keys, ranges, referential integrity).

## Site (`site/`)

Figures are from the independent QA pass 7 (docs/QA_REPORT.md, product HEAD e87fff5, run 2026-10-11 with `--workers 1`) and a release re-run of typecheck, lint, Vitest, build and pytest at release time.

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` (Vitest) | 9 test files, 70 tests passed |
| `npm run e2e` (Playwright, desktop and mobile projects, against `vite preview`, `--workers 1`) | 242 passed, 216 skipped (project-specific), 0 failed, 0 flaky (QA pass 7) |
| axe-core | 160 scans (10 scenes x normal and reduced motion x 1440, 1024, 1024-classic, 390, plus whole page), 0 violations |
| `npm run build` | passes; main JS 109.65 KB gz, CSS 13.48 KB gz, deckMap 203.43 KB gz |

## Quality gates

| Gate | Target | Result |
|---|---|---|
| Lighthouse performance (production build, QA pass 2, 3 runs, load 6.4 to 7.6) | 90+ | desktop 1.00 x3, mobile 0.99 x3 |
| Lighthouse accessibility | 95+ | 0.99 to 1.00 |
| LCP | 2.5 s or less | desktop 404 to 406 ms, mobile 1804 to 1806 ms |
| CLS | 0.1 or less | 0 to 0.013 |
| Frame pacing, device stated (Apple laptop, headless Chromium with software WebGL) | desktop ~60 fps, mobile ~30 fps+ | desktop p95 10.7 ms; 390x844 at 4x CPU throttle p95 28.3 ms (about 35 fps). Not a real phone |
| Screenshots at 1440x900, 768x1024, 390x844 plus scroll recording | read by an independent QA pass | PASSED (QA pass 7; evidence under `artifacts/evidence/qa*`) |
| Live Lighthouse, console, requests (public URL) | per gate | see `artifacts/evidence/live/` and docs/DEPLOYMENT.md |

## Independent QA history

Pass 1 FAILED (7 major) and passes 2 to 6 each found fewer, closed by FIX-001 to FIX-005; pass 7 PASSED with no blocker or major open after FIX-006. Open minors are listed in `docs/LIMITATIONS.md`.

## CI

`.github/workflows/ci.yml` runs pytest (`-m "not slow"`) and the site typecheck, lint, Vitest and build. Playwright e2e is excluded from CI: it needs browser binaries and software WebGL (deck.gl). It was run locally in full by QA (242 passed, 0 failed). Run it locally before every deploy.
