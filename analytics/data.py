"""Loaders over data/processed (aggregates produced by pipelines.modeling.aggregate)."""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
import polars as pl

from pipelines.common import PROCESSED, PUBLIC

MIN_CELL = 30          # min trips in a zone x hour-of-week cell to trust its median speed
MIN_ZONE_TRIPS = 5000  # min annual pickups for a zone to enter clustering / BPR (documented in METHODOLOGY)


def pq(name: str) -> pl.DataFrame:
    return pl.read_parquet(PROCESSED / f"{name}.parquet")


@lru_cache(maxsize=1)
def zone_dim() -> pl.DataFrame:
    fc = json.loads((PUBLIC / "zones.geojson").read_text())
    return pl.DataFrame([{"zone": f["properties"]["id"], "name": f["properties"]["name"], "borough": f["properties"]["borough"],
                          "cx": f["properties"]["cx"], "cy": f["properties"]["cy"]} for f in fc["features"]]).sort("zone")


def zone_how(period: str = "all", service: str = "all") -> pl.DataFrame:
    """zone x hour-of-week with mean trips per occurrence of that hour (how = dow*24 + hour)."""
    d = pq("how_dates").filter(pl.col("period") == period).select("dow", "hour", "n_dates")
    z = pq("zone_how").filter((pl.col("period") == period) & (pl.col("service") == service)).join(d, on=["dow", "hour"])
    return z.with_columns((pl.col("dow") * 24 + pl.col("hour")).alias("how"),
                          (pl.col("trips") / pl.col("n_dates")).alias("mean_trips")).sort("zone", "how")


def dense_profiles(df: pl.DataFrame, value: str = "mean_trips") -> tuple[np.ndarray, np.ndarray]:
    """(zones, matrix[n_zones,168]) with zeros where a cell is absent."""
    zones = np.array(sorted(df["zone"].unique().to_list()))
    idx = {z: i for i, z in enumerate(zones)}
    m = np.zeros((len(zones), 168))
    for z, h, v in zip(df["zone"].to_list(), df["how"].to_list(), df[value].to_list()):
        m[idx[z], h] = v
    return zones, m
