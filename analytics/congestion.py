"""Congestion indicator: zone-hour median speed / zone free-flow speed.

Free-flow speed of a zone := quantile Q (default 0.85) of the zone's hour-of-week median speeds over
the overnight window (default hours 2-5, all 7 weekdays = 28 cells), using only cells with >= MIN_CELL
trips and requiring >= MIN_FF_CELLS valid cells. Index < 1 means slower than that zone's own overnight
free flow. It is a proxy built from for-hire trips, not a road-network speed measurement.
"""
from __future__ import annotations

import numpy as np
import polars as pl

from analytics.data import MIN_CELL

MIN_FF_CELLS = 14
DEFAULT_FF = {"hours": (2, 3, 4, 5), "q": 0.85}


def free_flow(zh: pl.DataFrame, hours=DEFAULT_FF["hours"], q: float = DEFAULT_FF["q"]) -> pl.DataFrame:
    """Return zone, ff_mph (null when too few valid overnight cells)."""
    s = zh.filter(pl.col("hour").is_in(list(hours)) & (pl.col("trips") >= MIN_CELL))
    g = s.group_by("zone").agg(pl.col("speed_p50").quantile(q, "linear").alias("ff_mph"), pl.len().alias("n_cells"))
    g = g.with_columns(pl.when(pl.col("n_cells") >= MIN_FF_CELLS).then(pl.col("ff_mph")).otherwise(None).alias("ff_mph"))
    return g.select("zone", "ff_mph", "n_cells").sort("zone")


def congestion_index(zh: pl.DataFrame, ff: pl.DataFrame) -> pl.DataFrame:
    j = zh.join(ff, on="zone", how="left")
    return j.with_columns(
        pl.when((pl.col("trips") >= MIN_CELL) & pl.col("ff_mph").is_not_null())
        .then(pl.col("speed_p50") / pl.col("ff_mph")).otherwise(None).alias("cong_idx"))
