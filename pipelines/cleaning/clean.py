"""Unify yellow/green/fhvhv raw Parquet into the interim trip contract with DuckDB.

Every raw row is classified into exactly one of: kept, or the FIRST failing exclusion rule in
RULE_ORDER. So raw_rows == kept + sum(exclusions) per service-month by construction (and tested).
Unknown zones (not in 1..263) stay in `kept` and are counted separately (unknown_pu/do/od).

Usage: uv run python -m pipelines.cleaning.clean [--force]
"""
from __future__ import annotations

import argparse
import json
import time

import duckdb

from pipelines.common import INTERIM, LEDGER, MANIFESTS, MONTHS, RAW, SERVICES, YEAR, load_ledger

RULE_ORDER = ["null_timestamp", "ts_out_of_month", "nonpositive_duration", "bad_duration", "bad_distance", "implausible_speed"]

COLS = {  # service -> (pickup, dropoff, distance)
    "yellow": ("tpep_pickup_datetime", "tpep_dropoff_datetime", "trip_distance"),
    "green": ("lpep_pickup_datetime", "lpep_dropoff_datetime", "trip_distance"),
    "fhvhv": ("pickup_datetime", "dropoff_datetime", "trip_miles"),
}


def raw_path(service: str, month: int):
    return RAW / "tlc" / service / f"{service}_tripdata_{YEAR}-{month:02d}.parquet"


def is_complete(service: str, month: int) -> bool:
    p = raw_path(service, month)
    return p.exists() and not p.with_suffix(p.suffix + ".part").exists()


def classify_sql(service: str, month: int, src: str) -> str:
    p, d, dist = COLS[service]
    lo = f"TIMESTAMP '{YEAR}-{month:02d}-01'"
    hi = f"TIMESTAMP '{YEAR + (month == 12)}-{(month % 12) + 1:02d}-01'"
    extra = ", trip_time AS trip_time_s" if service == "fhvhv" else ", NULL::BIGINT AS trip_time_s"
    return f"""
    CREATE OR REPLACE TEMP TABLE t AS
    SELECT {p} AS pickup_ts, {d} AS dropoff_ts, PULocationID AS pu_zone, DOLocationID AS do_zone,
           {dist} AS distance_mi, date_diff('second', {p}, {d}) AS duration_s {extra},
           CASE
             WHEN {p} IS NULL OR {d} IS NULL THEN 'null_timestamp'
             WHEN {p} < {lo} OR {p} >= {hi} THEN 'ts_out_of_month'
             WHEN {d} <= {p} THEN 'nonpositive_duration'
             WHEN date_diff('second', {p}, {d}) < 60 OR date_diff('second', {p}, {d}) > 21600 THEN 'bad_duration'
             WHEN {dist} IS NULL OR isnan({dist}) OR {dist} <= 0 OR {dist} > 200 THEN 'bad_distance'
             WHEN {dist} / (date_diff('second', {p}, {d}) / 3600.0) > 80 THEN 'implausible_speed'
           END AS reason
    FROM read_parquet('{src}')"""


def clean_one(con: duckdb.DuckDBPyConnection, service: str, month: int) -> dict:
    src = str(raw_path(service, month))
    con.execute(classify_sql(service, month, src))
    raw_rows = con.execute("SELECT count(*) FROM t").fetchone()[0]
    reasons = dict(con.execute("SELECT reason, count(*) FROM t WHERE reason IS NOT NULL GROUP BY 1").fetchall())
    out_dir = INTERIM / f"service={service}" / f"month={month:02d}"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "part.parquet"
    zk = lambda c: f"({c} BETWEEN 1 AND 263)"
    con.execute(f"""
    COPY (SELECT '{service}'::VARCHAR AS service, pickup_ts, dropoff_ts,
                 pu_zone::SMALLINT AS pu_zone, do_zone::SMALLINT AS do_zone,
                 distance_mi::FLOAT AS distance_mi, duration_s::INTEGER AS duration_s,
                 (distance_mi / (duration_s / 3600.0))::FLOAT AS speed_mph,
                 hour(pickup_ts)::TINYINT AS hour_local, (isodow(pickup_ts) - 1)::TINYINT AS dow,
                 CAST(pickup_ts AS DATE) AS date_local
          FROM t WHERE reason IS NULL) TO '{out}' (FORMAT parquet, COMPRESSION zstd)""")
    kept, unk_pu, unk_do, unk_od, tt_mismatch = con.execute(f"""
        SELECT count(*), count(*) FILTER (WHERE NOT coalesce({zk('pu_zone')}, false)),
               count(*) FILTER (WHERE NOT coalesce({zk('do_zone')}, false)),
               count(*) FILTER (WHERE NOT (coalesce({zk('pu_zone')}, false) AND coalesce({zk('do_zone')}, false))),
               count(*) FILTER (WHERE trip_time_s IS NOT NULL AND abs(trip_time_s - duration_s) > 60)
        FROM t WHERE reason IS NULL""").fetchone()
    excl = {r: int(reasons.get(r, 0)) for r in RULE_ORDER}
    assert raw_rows == kept + sum(excl.values()), (service, month)
    return {"service": service, "month": month, "raw_rows": raw_rows, "kept": kept, "exclusions": excl,
            "unknown_pu": unk_pu, "unknown_do": unk_do, "unknown_od": unk_od,
            "kept_known_od": kept - unk_od, "trip_time_mismatch_gt60s": tt_mismatch,
            "raw_bytes": raw_path(service, month).stat().st_size}


def main(force: bool = False) -> None:
    ledger = load_ledger()
    con = duckdb.connect()
    for service in SERVICES:
        for m in MONTHS:
            key = f"{service}-{YEAR}-{m:02d}"
            if not is_complete(service, m):
                print(f"skip (raw incomplete) {key}")
                continue
            done = INTERIM / f"service={service}" / f"month={m:02d}" / "part.parquet"
            if not force and key in ledger and done.exists() and ledger[key]["raw_bytes"] == raw_path(service, m).stat().st_size:
                continue
            t0 = time.time()
            ledger[key] = clean_one(con, service, m)
            ledger[key]["seconds"] = round(time.time() - t0, 1)
            MANIFESTS.mkdir(parents=True, exist_ok=True)
            LEDGER.write_text(json.dumps(ledger, indent=2, sort_keys=True))
            print(f"cleaned {key}: raw={ledger[key]['raw_rows']:,} kept={ledger[key]['kept']:,} in {ledger[key]['seconds']}s", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    main(ap.parse_args().force)
