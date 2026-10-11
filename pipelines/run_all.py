"""One entrypoint: data/raw -> interim -> processed -> site/public/data -> docs/METHODOLOGY.md. Idempotent.

    uv run python -m pipelines.run_all [--fetch] [--force]

--fetch   run ingestion first (skips complete files; not run by default so a rerun needs no network)
--force   re-clean every raw file and rebuild all aggregates
Runtime per step is written to data/manifests/runtime.json.
"""
from __future__ import annotations

import argparse
import json
import time

from pipelines import contracts, publish
from pipelines.cleaning import clean
from pipelines.common import MANIFESTS
from pipelines.modeling import aggregate, zones


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    timings: dict[str, float] = {}

    def step(name, fn):
        t = time.time()
        fn()
        timings[name] = round(time.time() - t, 1)
        print(f"[{name}] {timings[name]}s", flush=True)

    if a.fetch:
        from pipelines.ingestion import fetch
        import sys
        sys.argv = ["fetch"]
        step("ingest", fetch.main)
    step("clean", lambda: clean.main(a.force))
    step("zones", zones.build)
    step("aggregate", lambda: aggregate.build(force=a.force))
    step("contracts", contracts.build)
    step("publish", publish.build_all)
    from analytics.exploration import eda
    from pipelines.common import ROOT
    step("methodology", lambda: (ROOT / "docs" / "METHODOLOGY.md").write_text(eda.render()))
    timings["total"] = round(sum(timings.values()), 1)
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    (MANIFESTS / "runtime.json").write_text(json.dumps(timings, indent=2))
    print("total", timings["total"], "s")


if __name__ == "__main__":
    main()
