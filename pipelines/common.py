"""Shared paths and constants for the Atlas pipeline."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim" / "trips_2024"
PROCESSED = ROOT / "data" / "processed"
MANIFESTS = ROOT / "data" / "manifests"
CONTRACTS = ROOT / "data" / "contracts"
PUBLIC = ROOT / "site" / "public" / "data"
LEDGER = MANIFESTS / "cleaning_ledger.json"

YEAR = 2024
SERVICES = ("yellow", "green", "fhvhv")
MONTHS = tuple(range(1, 13))
K_MIN = 11  # small-cell suppression threshold (docs/PROBLEM.md Ethics)
SCHEMA_VERSION = "v1"

# Hour bands (pickup hour, local wall clock). Edges inclusive.
BANDS = {"overnight": (0, 5), "am_peak": (6, 9), "midday": (10, 15), "pm_peak": (16, 19), "evening": (20, 23)}
BAND_ORDER = list(BANDS)


def band_case_sql(col: str = "hour_local") -> str:
    """SQL CASE mapping an hour column to a band index 0..4 (index into BAND_ORDER)."""
    return f"CASE WHEN {col} <= 5 THEN 0 WHEN {col} <= 9 THEN 1 WHEN {col} <= 15 THEN 2 WHEN {col} <= 19 THEN 3 ELSE 4 END"


def interim_glob() -> str:
    return str(INTERIM / "service=*" / "month=*" / "*.parquet")


def write_json(path: Path, obj, compact: bool = True) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(obj, separators=(",", ":"), sort_keys=True, allow_nan=False) if compact else json.dumps(obj, indent=2, sort_keys=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(s + "\n")
    os.replace(tmp, path)
    return len(s) + 1


def load_ledger() -> dict:
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {}
