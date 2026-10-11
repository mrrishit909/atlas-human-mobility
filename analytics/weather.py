"""Weather association model: log(daily trips) ~ precip bins + snow + TMAX + day-of-week + month + holiday.

OLS with Newey-West (HAC, 7 lags) standard errors. ASSOCIATION, not causation: single station,
citywide application, no control for events/strikes/outages beyond the holiday flag.
"""
from __future__ import annotations

import csv
import datetime as dt

import numpy as np
import polars as pl
import statsmodels.api as sm

from pipelines.common import RAW, YEAR

# US federal holidays observed in 2024 (OPM)
HOLIDAYS_2024 = [dt.date(2024, *md) for md in [(1, 1), (1, 15), (2, 19), (5, 27), (6, 19), (7, 4), (9, 2), (10, 14), (11, 11), (11, 28), (12, 25)]]
PRCP_BINS = [("light", 0.1, 2.5), ("moderate", 2.5, 12.7), ("heavy", 12.7, 1e9)]  # mm; dry (<0.1) is the reference


def load_weather() -> pl.DataFrame:
    rows = []
    with open(RAW / "weather" / "USW00094728.csv", newline="") as f:
        for r in csv.DictReader(f):
            if r["DATE"].startswith(str(YEAR)):
                num = lambda k, s: (float(r[k]) / s) if r[k].strip() not in ("", "null") else None
                rows.append({"date": dt.date.fromisoformat(r["DATE"]), "prcp_mm": num("PRCP", 10), "snow_mm": num("SNOW", 1),
                             "tmax_c": num("TMAX", 10), "tmin_c": num("TMIN", 10)})
    return pl.DataFrame(rows).sort("date")


def design(daily_total: pl.DataFrame, w: pl.DataFrame, continuous: bool = False) -> tuple[pl.DataFrame, list[str]]:
    d = daily_total.join(w, on="date", how="left").sort("date")
    cols = {}
    if continuous:
        cols["prcp_per_mm"] = d["prcp_mm"]
    else:
        for name, lo, hi in PRCP_BINS:
            cols[f"prcp_{name}"] = ((d["prcp_mm"] >= lo) & (d["prcp_mm"] < hi)).cast(pl.Float64)
    cols["snow_day"] = (d["snow_mm"] > 0).cast(pl.Float64)
    cols["tmax_per10c"] = d["tmax_c"] / 10.0
    cols["holiday"] = d["date"].map_elements(lambda x: float(x in HOLIDAYS_2024), return_dtype=pl.Float64)
    for k in range(1, 7):
        cols[f"dow_{['mon','tue','wed','thu','fri','sat','sun'][k]}"] = (d["date"].dt.weekday() - 1 == k).cast(pl.Float64)
    for m in range(2, 13):
        cols[f"month_{m:02d}"] = (d["date"].dt.month() == m).cast(pl.Float64)
    return d.with_columns([v.alias(k) for k, v in cols.items()]), list(cols)


def fit(daily_total: pl.DataFrame, w: pl.DataFrame, maxlags: int = 7, continuous: bool = False) -> dict:
    d, names = design(daily_total, w, continuous)
    d = d.drop_nulls(["trips", "prcp_mm", "tmax_c", "snow_mm"])
    X = sm.add_constant(d.select(names).to_numpy(), prepend=True)
    y = np.log(d["trips"].to_numpy().astype(float))
    res = sm.OLS(y, X).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})
    ci = res.conf_int(0.05)
    labels = ["const"] + names
    coefs = []
    for i, n in enumerate(labels):
        b, se = float(res.params[i]), float(res.bse[i])
        coefs.append({"term": n, "beta": b, "se": se, "ci_lo": float(ci[i, 0]), "ci_hi": float(ci[i, 1]), "p": float(res.pvalues[i]),
                      "pct_effect": float(np.expm1(b)), "pct_ci_lo": float(np.expm1(ci[i, 0])), "pct_ci_hi": float(np.expm1(ci[i, 1]))})
    return {"spec": ("log(daily trips, all services) ~ PRCP mm (continuous) " if continuous else "log(daily trips, all services) ~ precip bins (ref: dry < 0.1 mm) ") + "+ snow_day + TMAX per 10C + dow + month + federal holiday",
            "se": f"HAC Newey-West maxlags={maxlags}", "n": int(len(y)), "r2": float(res.rsquared), "adj_r2": float(res.rsquared_adj),
            "dropped_days": int(len(daily_total) - len(y)), "coefficients": coefs}
