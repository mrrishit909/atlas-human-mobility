"""Fact aggregates (DuckDB over interim Parquet) -> data/processed/*.parquet (intermediate, gitignored).

All spatial tables use PICKUP zone for hour/speed, restrict to known zones 1..263 and, for OD, to
known origin AND destination. Raw (unsuppressed) counts live here; suppression happens at publish time.
"""
from __future__ import annotations

import duckdb

from pipelines.common import PROCESSED, band_case_sql, interim_glob

SRC = f"read_parquet('{interim_glob()}', hive_partitioning=true)"
PERIOD_TRAIN_MAX_MONTH = 9  # temporal holdout: train Jan-Sep, test Oct-Dec


def _copy(con, name: str, sql: str) -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY ({sql}) TO '{PROCESSED / (name + '.parquet')}' (FORMAT parquet, COMPRESSION zstd)")


def _fresh(name: str) -> bool:
    """True when the processed table is newer than every interim part (idempotent skip for the slow step)."""
    from pathlib import Path
    f = PROCESSED / f"{name}.parquet"
    if not f.exists() or f.stat().st_size == 0:
        return False
    return all(f.stat().st_mtime > Path(p).stat().st_mtime for p in __import__("glob").glob(interim_glob()))


def build_od_band() -> None:
    """Exact per-(o,d,band) quantiles with polars (DuckDB quantile_cont is far too slow at 350k groups).
    band 0..4 = BANDS order; band 5 = all hours (DR-5)."""
    import polars as pl
    lf = (pl.scan_parquet(interim_glob(), hive_partitioning=True)
          .filter(pl.col("pu_zone").is_between(1, 263) & pl.col("do_zone").is_between(1, 263))
          .select(pl.col("pu_zone").cast(pl.Int16).alias("o"), pl.col("do_zone").cast(pl.Int16).alias("d"),
                  pl.col("hour_local").cast(pl.Int8).alias("h"), pl.col("duration_s").cast(pl.Float64).alias("dur"),
                  pl.col("speed_mph").cast(pl.Float64).alias("spd"), pl.col("distance_mi").cast(pl.Float64).alias("dist")))
    band = pl.when(pl.col("h") <= 5).then(0).when(pl.col("h") <= 9).then(1).when(pl.col("h") <= 15).then(2).when(pl.col("h") <= 19).then(3).otherwise(4).cast(pl.Int8)
    q = lambda c, p: pl.col(c).quantile(p, "linear")
    aggs = [pl.len().alias("trips"), q("dur", .1).alias("dur_p10"), q("dur", .5).alias("dur_p50"), q("dur", .9).alias("dur_p90"),
            q("spd", .1).alias("spd_p10"), q("spd", .5).alias("spd_p50"), q("spd", .9).alias("spd_p90"), q("dist", .5).alias("dist_p50")]
    lf = lf.with_columns(band.alias("band"))
    per_band = lf.group_by("o", "d", "band").agg(aggs)
    allh = lf.group_by("o", "d").agg(aggs).with_columns(pl.lit(5, dtype=pl.Int8).alias("band"))
    out = pl.concat([per_band, allh.select(per_band.collect_schema().names())]).sort("o", "d", "band")
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out.collect(engine="streaming").write_parquet(PROCESSED / "od_band.parquet", compression="zstd")


TABLES = ["zone_how", "how_dates", "borough_how", "zone_month", "od_band", "od_total", "daily", "service_month", "hourly", "trip_dist_summary"]


def build(con: duckdb.DuckDBPyConnection | None = None, force: bool = False) -> None:
    if not force and all(_fresh(t) for t in TABLES):
        print("aggregate: processed tables are newer than interim data, skipping")
        return
    con = con or duckdb.connect()
    con.execute(f"CREATE OR REPLACE VIEW trips AS SELECT *, month(date_local) AS m FROM {SRC}")
    known_pu = "pu_zone BETWEEN 1 AND 263"
    known_od = f"{known_pu} AND do_zone BETWEEN 1 AND 263"

    # zone x dow x hour x service(+all) (annual) and pooled train/test periods
    zh_cols = "pu_zone AS zone, dow::INTEGER AS dow, hour_local::INTEGER AS hour, count(*) AS trips, median(speed_mph) AS speed_p50, median(duration_s) AS dur_p50, median(distance_mi) AS dist_p50"
    parts = [f"SELECT 'all' AS period, service, {zh_cols} FROM trips WHERE {known_pu} GROUP BY ALL",
             f"SELECT 'all' AS period, 'all' AS service, {zh_cols} FROM trips WHERE {known_pu} GROUP BY ALL",
             f"SELECT 'train' AS period, 'all' AS service, {zh_cols} FROM trips WHERE {known_pu} AND m <= {PERIOD_TRAIN_MAX_MONTH} GROUP BY ALL",
             f"SELECT 'test' AS period, 'all' AS service, {zh_cols} FROM trips WHERE {known_pu} AND m > {PERIOD_TRAIN_MAX_MONTH} GROUP BY ALL"]
    _copy(con, "zone_how", " UNION ALL ".join(parts) + " ORDER BY 1,2,3,4,5")

    # number of calendar occurrences of each (dow, hour) with any trip citywide (handles DST gaps)
    _copy(con, "how_dates", f"""SELECT p.period, dow::INTEGER AS dow, hour_local::INTEGER AS hour, count(DISTINCT date_local) AS n_dates
        FROM trips, (VALUES ('all', 1, 12), ('train', 1, 9), ('test', 10, 12)) p(period, lo, hi) WHERE m BETWEEN p.lo AND p.hi GROUP BY ALL ORDER BY 1,2,3""")

    from analytics.data import zone_dim
    con.register("zdim", zone_dim().select("zone", "borough").to_arrow())
    bsrc = "trips JOIN zdim ON trips.pu_zone = zdim.zone"
    bcols = "borough, dow::INTEGER AS dow, hour_local::INTEGER AS hour, count(*) AS trips, median(speed_mph) AS speed_p50, median(duration_s) AS dur_p50, median(distance_mi) AS dist_p50"
    _copy(con, "borough_how", " UNION ALL ".join([
        f"SELECT 'all' AS period, {bcols} FROM {bsrc} GROUP BY ALL",
        f"SELECT 'train' AS period, {bcols} FROM {bsrc} WHERE m <= {PERIOD_TRAIN_MAX_MONTH} GROUP BY ALL",
        f"SELECT 'test' AS period, {bcols} FROM {bsrc} WHERE m > {PERIOD_TRAIN_MAX_MONTH} GROUP BY ALL"]) + " ORDER BY 1,2,3,4")

    _copy(con, "zone_month", f"""
        SELECT service, m AS month, z AS zone, sum(pu) AS pickups, sum(dr) AS dropoffs FROM (
          SELECT service, m, pu_zone AS z, count(*) AS pu, 0 AS dr FROM trips WHERE {known_pu} GROUP BY ALL
          UNION ALL SELECT service, m, do_zone, 0, count(*) FROM trips WHERE do_zone BETWEEN 1 AND 263 GROUP BY ALL)
        GROUP BY ALL ORDER BY 1,2,3""")

    if not _fresh("od_band"):
        build_od_band()

    _copy(con, "od_total", f"SELECT pu_zone AS o, do_zone AS d, count(*) AS trips FROM trips WHERE {known_od} GROUP BY ALL ORDER BY 1,2")
    _copy(con, "daily", "SELECT date_local AS date, service, count(*) AS trips FROM trips GROUP BY ALL ORDER BY 1,2")
    # kept rows by service-month & unknown-zone class straight from interim (for reconciliation tests)
    _copy(con, "service_month", f"""SELECT service, m AS month, count(*) AS kept,
        count(*) FILTER (WHERE NOT coalesce({known_pu}, false)) AS unknown_pu,
        count(*) FILTER (WHERE NOT coalesce({known_od}, false)) AS unknown_od FROM trips GROUP BY ALL ORDER BY 1,2""")
    # hourly series for EDA (kept rows)
    _copy(con, "hourly", "SELECT date_local AS date, hour_local::INTEGER AS hour, service, count(*) AS trips, median(speed_mph) AS speed_p50 FROM trips GROUP BY ALL ORDER BY 1,2,3")
    _copy(con, "trip_dist_summary", """SELECT service, count(*) n, avg(distance_mi) mean_mi, median(distance_mi) p50_mi, quantile_cont(distance_mi,0.99) p99_mi,
        avg(duration_s) mean_s, median(duration_s) p50_s, quantile_cont(duration_s,0.99) p99_s, median(speed_mph) p50_mph,
        quantile_cont(speed_mph,0.01) p01_mph, quantile_cont(speed_mph,0.99) p99_mph, quantile_cont(speed_mph,0.9999) p9999_mph FROM trips GROUP BY ALL ORDER BY 1""")


if __name__ == "__main__":
    build()
