"""BPR scenario model (SIMULATED outputs; fitted to OBSERVED hour-of-week pairs).

Observation (group g, hour-of-week h):
    v = mean trips per hour (all services)           demand volume, trips/hour
    C = V_ref(g) = p95 of the group's 168 hourly v   "capacity index": a NORMALIZATION (the busiest-5%
                                                     hour volume), not an engineered road capacity
    y = TTI = ff(g) / median_speed(g, h)  = t / t0   pace ratio vs. the group's free flow
BPR:  y = 1 + alpha * (v / C)^beta, alpha and beta fitted by bounded nonlinear least squares
(several starts). With C pinned to V_ref, alpha is identified (alpha, beta, C are not all identifiable
from data, so C is fixed by definition). Groups: borough (primary, 168 pts each) and zone-pooled
per borough (secondary, many pts). Scenarios scale v by demand_mult and C by capacity_mult.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import polars as pl
from scipy.optimize import least_squares

A_BOUNDS = (0.0, 50.0)
BETA_BOUNDS = (0.2, 10.0)


def bpr_ratio(v, alpha: float, beta: float, c: float):
    """t / t0 = 1 + alpha * (v / C)^beta."""
    return 1.0 + alpha * (np.asarray(v, dtype=float) / c) ** beta


def fitted_speed(ff_mph: float, v: float, alpha: float, beta: float, c: float) -> float:
    """Model baseline speed at volume v (a point on the fitted curve)."""
    return ff_mph / float(bpr_ratio(v, alpha, beta, c))


def scenario_speed(obs_speed_mph: float, v: float, c: float, alpha: float, beta: float,
                   demand_mult: float = 1.0, capacity_mult: float = 1.0) -> float:
    """Anchored scenario: observed speed scaled by the fitted curve's change from (v, C) to (v*dm, C*cm).

    demand_mult = capacity_mult = 1 returns obs_speed_mph EXACTLY. Pure function; ported to TypeScript.
    """
    base = bpr_ratio(v, alpha, beta, c)
    new = bpr_ratio(v * demand_mult, alpha, beta, c * capacity_mult)
    return float(obs_speed_mph * (base / new))  # base/new is exactly 1.0 at dm = cm = 1


def scenario_fitted_speed(ff_mph: float, v: float, c: float, alpha: float, beta: float,
                          demand_mult: float = 1.0, capacity_mult: float = 1.0) -> float:
    """Unanchored: model speed at (v*dm, C*cm). At 1/1 equals fitted_speed exactly."""
    return ff_mph / float(bpr_ratio(v * demand_mult, alpha, beta, c * capacity_mult))


@dataclass
class Fit:
    alpha: float
    beta: float
    c: float  # = 1.0 in normalized units (x = v / V_ref)
    n: int
    r2: float
    rmse: float
    x_max: float
    converged: bool


def fit_curve(x: np.ndarray, y: np.ndarray) -> Fit:
    def resid(p):
        return 1.0 + p[0] * x ** p[1] - y
    best = None
    for b0 in (1.0, 2.0, 4.0):
        for a0 in (0.05, 0.3):
            r = least_squares(resid, [a0, b0], bounds=([A_BOUNDS[0], BETA_BOUNDS[0]], [A_BOUNDS[1], BETA_BOUNDS[1]]), x_scale=[0.1, 1.0])
            if best is None or r.cost < best.cost - 1e-12:
                best = r
    a, beta = float(best.x[0]), float(best.x[1])
    pred = 1.0 + a * x ** beta
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    return Fit(alpha=a, beta=beta, c=1.0, n=int(len(y)), r2=1 - ss_res / ss_tot if ss_tot > 0 else float("nan"),
               rmse=float(np.sqrt(ss_res / len(y))), x_max=float(x.max()), converged=bool(best.success))


def build_obs(zh: pl.DataFrame, mean_trips: pl.DataFrame, ff: pl.DataFrame, vref: pl.DataFrame, min_cell: int) -> pl.DataFrame:
    """zone-hour observations with x, y. zh: zone,how,trips,speed_p50; mean_trips: zone,how,mean_trips."""
    j = (zh.select("zone", "how", "trips", "speed_p50").join(mean_trips.select("zone", "how", "mean_trips"), on=["zone", "how"])
         .join(ff.select("zone", "ff_mph"), on="zone").join(vref, on="zone"))
    j = j.filter((pl.col("trips") >= min_cell) & pl.col("ff_mph").is_not_null() & (pl.col("vref") > 0))
    return j.with_columns((pl.col("mean_trips") / pl.col("vref")).alias("x"), (pl.col("ff_mph") / pl.col("speed_p50")).alias("y"))


def metrics(fit: Fit, x: np.ndarray, y: np.ndarray, baseline_y: float) -> dict:
    pred = 1.0 + fit.alpha * x ** fit.beta
    sse = float(np.sum((y - pred) ** 2))
    sse_const = float(np.sum((y - baseline_y) ** 2))
    sse_ff = float(np.sum((y - 1.0) ** 2))
    return {"n": int(len(y)), "rmse": float(np.sqrt(sse / len(y))), "r2_vs_const": 1 - sse / sse_const if sse_const > 0 else float("nan"),
            "rmse_const_train_mean": float(np.sqrt(sse_const / len(y))), "rmse_freeflow_const": float(np.sqrt(sse_ff / len(y))),
            "skill_vs_freeflow": 1 - sse / sse_ff}


# ---------------------------------------------------------------- borough / zone observation builders
BOROUGHS = ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island"]  # EWR (1 zone) has too little data


def borough_ff(bt: pl.DataFrame, hours=(2, 3, 4, 5), q: float = 0.85) -> dict[str, float]:
    from analytics.data import MIN_CELL
    s = bt.filter(pl.col("hour").is_in(list(hours)) & (pl.col("trips") >= MIN_CELL))
    return {r["borough"]: float(r["ff"]) for r in s.group_by("borough").agg(pl.col("speed_p50").quantile(q, "linear").alias("ff")).iter_rows(named=True)}


def borough_table(period: str) -> pl.DataFrame:
    """borough x hour-of-week: v (mean trips/hour), median speed, median trip duration (min)."""
    from analytics.data import pq
    d = pq("how_dates").filter(pl.col("period") == period).select("dow", "hour", "n_dates")
    t = pq("borough_how").filter((pl.col("period") == period) & pl.col("borough").is_in(BOROUGHS)).join(d, on=["dow", "hour"])
    return t.with_columns((pl.col("dow") * 24 + pl.col("hour")).alias("how"), (pl.col("trips") / pl.col("n_dates")).alias("v"),
                          (pl.col("dur_p50") / 60.0).alias("dur_min")).sort("borough", "how")


def borough_obs(period: str, ff: dict | None = None, vref: dict | None = None, hours=(2, 3, 4, 5), q: float = 0.85) -> dict:
    """Return {borough: {ff, vref, df(how, v, x, speed, dur_min, y)}}. Pass ff/vref from the train period for holdout."""
    bt = borough_table(period)
    ff = ff or borough_ff(bt, hours, q)
    out = {}
    for b in BOROUGHS:
        s = bt.filter(pl.col("borough") == b)
        vr = (vref or {}).get(b) or float(np.quantile(s["v"].to_numpy(), 0.95))
        s = s.with_columns((pl.col("v") / vr).alias("x"), (ff[b] / pl.col("speed_p50")).alias("y"))
        out[b] = {"ff": ff[b], "vref": vr, "df": s}
    return out


def zone_obs_by_borough(period: str, ff: pl.DataFrame | None = None, vref: pl.DataFrame | None = None, hours=(2, 3, 4, 5), q: float = 0.85) -> tuple[dict, pl.DataFrame, pl.DataFrame]:
    from analytics import congestion as cg
    from analytics.data import MIN_CELL, MIN_ZONE_TRIPS, zone_dim, zone_how
    zh = zone_how(period)
    ff = ff if ff is not None else cg.free_flow(zh, hours, q)
    if vref is None:
        vref = zh.group_by("zone").agg(pl.col("mean_trips").quantile(0.95, "linear").alias("vref"))
    big = zh.group_by("zone").agg(pl.col("trips").sum().alias("tot")).filter(pl.col("tot") >= MIN_ZONE_TRIPS * (1 if period == "all" else 0.25))
    obs = build_obs(zh.join(big.select("zone"), on="zone"), zh, ff, vref, MIN_CELL).join(zone_dim().select("zone", "borough"), on="zone")
    return {b: obs.filter(pl.col("borough") == b) for b in BOROUGHS}, ff, vref
