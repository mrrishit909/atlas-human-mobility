"""Idempotent raw-source ingestion for ATLAS OF HUMAN MOBILITY.

Downloads every source listed in SOURCES into data/raw/ (gitignored), skips files whose
size already matches the server's Content-Length, verifies completeness, and records
url / bytes / sha256 / server Last-Modified / retrieval time in data/manifests/raw_manifest.json.

Sources (all OBSERVED, see docs/DATA_SOURCES.md):
- NYC TLC trip records 2024 (yellow, green, high-volume FHV), monthly Parquet
- NYC TLC taxi zone shapefile + lookup
- NOAA GHCN-Daily station USW00094728 (Central Park)

Usage: uv run python pipelines/ingestion/fetch.py [--only yellow,green,fhvhv,zones,weather] [--months 1-12]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifests" / "raw_manifest.json"
TLC = "https://d37ci6vzurychx.cloudfront.net"
YEAR = 2024


def sources(only: set[str], months: range) -> list[tuple[str, str, Path]]:
    out = []
    for kind in ("yellow", "green", "fhvhv"):
        if kind in only:
            for m in months:
                name = f"{kind}_tripdata_{YEAR}-{m:02d}.parquet"
                out.append((kind, f"{TLC}/trip-data/{name}", RAW / "tlc" / kind / name))
    if "zones" in only:
        out.append(("zones", f"{TLC}/misc/taxi_zones.zip", RAW / "zones" / "taxi_zones.zip"))
        out.append(("zones", f"{TLC}/misc/taxi_zone_lookup.csv", RAW / "zones" / "taxi_zone_lookup.csv"))
    if "weather" in only:
        out.append(("weather", "https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/USW00094728.csv",
                    RAW / "weather" / "USW00094728.csv"))
    return out


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, dest: Path, retries: int = 4) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    head = requests.head(url, timeout=60, allow_redirects=True)
    head.raise_for_status()
    expected = int(head.headers.get("content-length", -1))
    last_mod = head.headers.get("last-modified")
    # weather file is re-published daily; size match is the idempotency key for immutable TLC files only
    if dest.exists() and expected > 0 and dest.stat().st_size == expected:
        return {"url": url, "bytes": expected, "last_modified": last_mod, "skipped": True}
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, retries + 1):
        try:
            with requests.get(url, stream=True, timeout=120) as r:
                r.raise_for_status()
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            got = tmp.stat().st_size
            if expected > 0 and got != expected:
                raise IOError(f"incomplete download {got} != {expected}")
            os.replace(tmp, dest)
            return {"url": url, "bytes": got, "last_modified": last_mod, "skipped": False}
        except Exception as e:  # network failures: retry with backoff, then surface
            print(f"  attempt {attempt} failed for {url}: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"failed after {retries} attempts: {url}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="zones,weather,yellow,green,fhvhv")
    ap.add_argument("--months", default="1-12")
    a = ap.parse_args()
    lo, hi = (int(x) for x in a.months.split("-"))
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    for kind, url, dest in sources(set(a.only.split(",")), range(lo, hi + 1)):
        rec = fetch(url, dest)
        rel = str(dest.relative_to(ROOT))
        if not rec["skipped"] or rel not in manifest:
            rec["sha256"] = sha256(dest)
        else:
            rec["sha256"] = manifest[rel]["sha256"]
        rec.update(kind=kind, retrieved_at=manifest.get(rel, {}).get("retrieved_at") if rec["skipped"] else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        rec.pop("skipped")
        manifest[rel] = rec
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        tmp = MANIFEST.with_suffix(".tmp")
        tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True))
        os.replace(tmp, MANIFEST)
        print(f"ok {rel} {rec['bytes']:,} bytes")


if __name__ == "__main__":
    main()
