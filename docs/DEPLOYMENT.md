# Deployment

Target: GitHub Pages at https://mrrishit909.github.io/atlas-human-mobility/ (deployed 2026-10-11 from the public repo https://github.com/mrrishit909/atlas-human-mobility, Pages source `gh-pages` at `/`).

## How

`scripts/deploy_site_pages.sh <repo-name>` (copy of the shared `~/data-frontier/shared/deployment/deploy_site_pages.sh`; repo name is its only argument):

```bash
scripts/deploy_site_pages.sh atlas-human-mobility
```

It runs `npm run build` in `site/` (which runs `tsc --noEmit` first), writes `site/dist` to a temporary worktree on the `gh-pages` branch with `.nojekyll`, pushes `gh-pages`, then creates or updates the Pages source to `gh-pages` at `/` through the GitHub API using the git credential helper's token. It must be run from a clean checkout of the repo with an `origin` remote.

Base path `/atlas-human-mobility/` is set in `site/vite.config.ts`; the Playwright config and `npm run preview` use the same path on port 4301.

## Pre-deploy checklist (the release gate)

1. `uv run pytest -q -m "not slow"`, then in `site/`: `npm run typecheck`, `lint`, `test`, `e2e`.
2. `npm run build && npm run preview`; run the evidence harness for screenshots at 1440x900, 768x1024, 390x844 and a scroll recording; have an independent QA pass read the images.
3. Lighthouse and axe on the production build.
4. Deploy, then verify: `curl -sI https://mrrishit909.github.io/atlas-human-mobility/` returns 200, data files under `/atlas-human-mobility/data/` return 200, and take a real screenshot of the live URL.
5. Add the case study to the projects site (`portfolio/01-atlas-human-mobility/project.json` is the draft; schema `contracts/portfolio.schema.json`) and verify every link.

Results: steps 1 to 3 PASSED (independent QA pass 7, docs/QA_REPORT.md). Steps 4 and 5: live checks are saved under `artifacts/evidence/live/` and summarized in `docs/BUILD_STATUS.md`; the case study is on the projects site branch `add-atlas-human-mobility` pending the orchestrator merge.

## Licence

No code licence file (`LICENSE`) is included. The choice of licence is a pending owner decision; until then the code is published without one (all rights reserved by default). Data attributions are in `docs/DATA_SOURCES.md`.

## CI

`.github/workflows/ci.yml` runs on push and pull request; it does not deploy. Deployment stays a manual script so a failing gate cannot publish.

## Rollback

Pages serves the `gh-pages` branch; revert by force-pushing a previous `gh-pages` commit or re-running the script from an earlier tag.
