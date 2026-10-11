import hashlib
import json

import numpy as np
import polars as pl
import pytest

from analytics import bpr, clustering, weather
from pipelines.common import PUBLIC


def h(o):
    return hashlib.sha256(json.dumps(o, sort_keys=True).encode()).hexdigest()


def test_scenario_identity_exact(art):
    fit = art("bpr_fit.json")
    for b, d in fit["boroughs"].items():
        for r in d["baseline"]:
            v, c = r["v"], d["capacity_index"]
            assert bpr.scenario_speed(r["median_speed_mph"], v, c, d["alpha"], d["beta"], 1.0, 1.0) == r["median_speed_mph"]
            fs = bpr.scenario_fitted_speed(d["free_flow_mph"], v, c, d["alpha"], d["beta"], 1.0, 1.0)
            assert fs == bpr.fitted_speed(d["free_flow_mph"], v, d["alpha"], d["beta"], c)


def test_scenario_monotone():
    a = dict(alpha=0.8, beta=1.5, c=1000.0)
    s0 = bpr.scenario_speed(12.0, 900.0, **a)
    assert bpr.scenario_speed(12.0, 900.0, **a, demand_mult=1.3) < s0 < bpr.scenario_speed(12.0, 900.0, **a, demand_mult=0.7)
    assert bpr.scenario_speed(12.0, 900.0, **a, capacity_mult=1.3) > s0


def test_vectors_match_python(art):
    tv = art("bpr_test_vectors.json")
    assert any(v["case"].startswith("Manhattan/borough") for v in tv["vectors"])
    assert {v["case"].split("/")[0] for v in tv["vectors"]} >= {"Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island"}
    for v in tv["vectors"]:
        i, e = v["inputs"], v["expected"]
        got = bpr.scenario_speed(i["obs_speed_mph"], i["v"], i["c"], i["alpha"], i["beta"], i["demand_mult"], i["capacity_mult"])
        assert abs(got - e["scenario_speed_mph"]) <= 1e-9 * abs(got)
        if i["demand_mult"] == 1 and i["capacity_mult"] == 1:
            assert got == i["obs_speed_mph"]
            assert e["scenario_fitted_speed_mph"] == e["fitted_speed_mph"]


def test_bpr_fit_recovers_known_curve():
    rng = np.random.default_rng(0)
    x = rng.uniform(0.05, 1.2, 400)
    y = 1 + 0.6 * x ** 2.0 + rng.normal(0, 0.01, 400)
    f = bpr.fit_curve(x, y)
    assert abs(f.alpha - 0.6) < 0.05 and abs(f.beta - 2.0) < 0.15 and f.r2 > 0.99


def test_bpr_artifact_fields(art):
    fit = art("bpr_fit.json")
    for b, d in fit["boroughs"].items():
        assert len(d["baseline"]) == 168 and len(d["binned_points"]) <= 40
        assert 0.2 <= d["beta"] <= 10 and d["alpha"] >= 0 and d["n"] == 168 and d["x_max_observed"] > 0
        assert 0 < d["r2"] <= 1 and d["t0_min_per_mile"] == pytest.approx(60 / d["free_flow_mph"], rel=1e-3)
        ho = d["holdout"]["borough_level"]["test"]
        assert ho["skill_vs_freeflow"] > 0 and ho["rmse"] < ho["rmse_const_train_mean"]  # beats both constant baselines


def test_validation_artifact(art):
    v = art("validation.json")
    assert v["clustering"]["stability"]["ari_mean"] > 0.8
    assert set(v["ff_robustness"]) >= {"p85_0205 (main)", "median_0205"}


def test_reproducible_deterministic_steps(art):
    zh = art("zone_hour_week.json")
    arr = np.array([v if v is not None else 0.0 for v in zh["mean_trips"]["all"]]).reshape(263, 168)
    arr = arr[arr.sum(1) > 0]
    x = clustering.normalize(arr)
    runs = [h(clustering.fit(x, 4).tolist()) for _ in range(2)]
    assert runs[0] == runs[1]
    xs = np.linspace(0.1, 1.1, 50); ys = 1 + 0.4 * xs ** 1.7
    f1, f2 = bpr.fit_curve(xs, ys), bpr.fit_curve(xs, ys)
    assert h([f1.alpha, f1.beta]) == h([f2.alpha, f2.beta])


def test_holidays_and_weather_design():
    assert len(weather.HOLIDAYS_2024) == 11 and all(d.year == 2024 for d in weather.HOLIDAYS_2024)
    import datetime as dt
    days = [dt.date(2024, 1, 1) + dt.timedelta(i) for i in range(366)]
    rng = np.random.default_rng(1)
    prcp = rng.choice([0, 0, 0, 3, 10], 366).astype(float)
    tot = pl.DataFrame({"date": days, "trips": (500000 * np.exp(-0.002 * prcp + rng.normal(0, 0.01, 366))).astype(int)})
    w = pl.DataFrame({"date": days, "prcp_mm": prcp, "snow_mm": np.zeros(366), "tmax_c": rng.uniform(0, 30, 366), "tmin_c": np.zeros(366)})
    res = weather.fit(tot, w, continuous=True)
    c = next(c for c in res["coefficients"] if c["term"] == "prcp_per_mm")
    assert c["ci_lo"] < -0.002 < c["ci_hi"] and res["n"] == 366
