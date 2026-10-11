"""Independent validation: temporal holdout, baselines, robustness, clustering sanity checks.

Nothing here is tuned to look good: holdout parameters are fit on Jan-Sep only (free flow and V_ref
also come from Jan-Sep) and scored on Oct-Dec against (a) a constant free-flow baseline (y = 1) and
(b) a constant train-mean baseline.
"""
from __future__ import annotations

import numpy as np
import polars as pl

from analytics import bpr, clustering
from analytics.data import MIN_ZONE_TRIPS, dense_profiles, zone_how

FF_VARIANTS = {"p85_0205 (main)": ((2, 3, 4, 5), 0.85), "median_0205": ((2, 3, 4, 5), 0.5), "p90_0105": ((1, 2, 3, 4, 5), 0.9), "p75_0005": ((0, 1, 2, 3, 4, 5), 0.75)}


def _xy(df: pl.DataFrame):
    return df["x"].to_numpy(), df["y"].to_numpy()


def bpr_holdout() -> dict:
    train = bpr.borough_obs("train")
    ff = {b: train[b]["ff"] for b in bpr.BOROUGHS}
    vref = {b: train[b]["vref"] for b in bpr.BOROUGHS}
    test = bpr.borough_obs("test", ff=ff, vref=vref)
    out = {"borough_level": {}, "zone_level": {}}
    for b in bpr.BOROUGHS:
        x, y = _xy(train[b]["df"])
        f = bpr.fit_curve(x, y)
        xt, yt = _xy(test[b]["df"])
        out["borough_level"][b] = {"train": {"n": f.n, "r2": f.r2, "rmse": f.rmse}, "alpha": f.alpha, "beta": f.beta,
                                   "test": bpr.metrics(f, xt, yt, float(y.mean()))}
    ztr, ff_z, vref_z = bpr.zone_obs_by_borough("train")
    zte, _, _ = bpr.zone_obs_by_borough("test", ff=ff_z, vref=vref_z)
    for b in bpr.BOROUGHS:
        x, y = _xy(ztr[b])
        f = bpr.fit_curve(x, y)
        xt, yt = _xy(zte[b])
        out["zone_level"][b] = {"train": {"n": f.n, "r2": f.r2, "rmse": f.rmse}, "alpha": f.alpha, "beta": f.beta,
                                "test": bpr.metrics(f, xt, yt, float(y.mean()))}
    return out


def ff_robustness() -> dict:
    out = {}
    for name, (hours, q) in FF_VARIANTS.items():
        obs = bpr.borough_obs("all", hours=hours, q=q)
        row = {}
        for b in bpr.BOROUGHS:
            f = bpr.fit_curve(*_xy(obs[b]["df"]))
            row[b] = {"ff_mph": obs[b]["ff"], "alpha": f.alpha, "beta": f.beta, "r2": f.r2}
        out[name] = row
    return out


def cluster_checks() -> dict:
    zh = zone_how("all")
    tot = zh.group_by("zone").agg(pl.col("trips").sum().alias("t"))
    zones, m = dense_profiles(zh)
    keep = np.array([tot.filter(pl.col("zone") == z)["t"][0] >= MIN_ZONE_TRIPS for z in zones])
    x = clustering.normalize(m[keep])
    k, sil = clustering.select_k(x)
    labels = clustering.fit(x, k)
    return {"n_zones": int(keep.sum()), "n_excluded": int((~keep).sum()), "k": k, "silhouette_by_k": sil,
            "stability": clustering.stability(x, k), "random_baseline": clustering.random_baseline(x, labels)}


def run() -> dict:
    return {"bpr_holdout": bpr_holdout(), "ff_robustness": ff_robustness(), "clustering": cluster_checks()}
