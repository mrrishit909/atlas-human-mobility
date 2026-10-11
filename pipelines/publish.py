"""Build every published artifact in site/public/data/ from data/processed + analytics (deterministic).

Each artifact: schema_version "v1" and `tags` per field group (OBSERVED / DERIVED / PREDICTED / SIMULATED).
Small-cell suppression (< K_MIN trips) is applied here; suppressed cells/trips are recorded in
reconciliation.json. Pre-suppression numbers (facts) come from data/processed aggregates of the interim data.
"""
from __future__ import annotations

import datetime as dt
import gzip
import json
import math

import numpy as np
import polars as pl

from analytics import bpr, clustering, congestion as cg, network, weather
from analytics.data import MIN_CELL, MIN_ZONE_TRIPS, dense_profiles, pq, zone_dim, zone_how
from analytics.evaluation import validate
from pipelines.common import BANDS, BAND_ORDER, K_MIN, MANIFESTS, PUBLIC, SCHEMA_VERSION, load_ledger, write_json
from pipelines.modeling import ring, zones

PIPELINE_VERSION = "1.0.0"
SERVICES = ["all", "yellow", "green", "fhvhv"]
ZONES = list(range(1, 264))
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
OD_TOP_N = 300        # per hour band
OD_TOP_ALL_N = 2000   # band "all" (DR-5)
RING_TOP_N = 600
BAND_LABELS = {"overnight": "Overnight 12-6 AM", "am_peak": "AM peak 6-10 AM", "midday": "Midday 10 AM-4 PM", "pm_peak": "PM peak 4-8 PM", "evening": "Evening 8 PM-12 AM"}
BANDS_META = [{"id": k, "label": BAND_LABELS[k], "hours": list(range(lo, hi + 1))} for k, (lo, hi) in BANDS.items()]
ZIDX = {z: i for i, z in enumerate(ZONES)}


def py(o):
    """JSON-safe conversion (numpy scalars, NaN -> null)."""
    if isinstance(o, dict):
        return {str(k): py(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [py(v) for v in o]
    if isinstance(o, np.ndarray):
        return py(o.tolist())
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not math.isfinite(float(o)) else float(o)
    return o


def hour_label(h: int) -> str:
    return f"{h % 12 or 12} {'AM' if h < 12 else 'PM'}"


def how_label(how: int) -> str:
    return f"{DAYS[how // 24]} {hour_label(how % 24)}"


def art(tags: dict, **body) -> dict:
    return {"schema_version": SCHEMA_VERSION, "tags": tags, **body}


def dense_zone_how(df: pl.DataFrame, col: str) -> np.ndarray:
    m = np.full((263, 168), np.nan)
    for z, h, v in zip(df["zone"].to_list(), df["how"].to_list(), df[col].to_list()):
        m[ZIDX[z], h] = np.nan if v is None else v
    return m


def rnd(a: np.ndarray, nd: int) -> list:
    return [None if not np.isfinite(x) else round(float(x), nd) for x in a.ravel()]


# ------------------------------------------------------------------ individual artifacts
def build_zone_hour_week(supp: dict) -> dict:
    mean_t, speed, trips_n = {}, {}, {}
    for s in SERVICES:
        zh = zone_how("all", s)
        tr = dense_zone_how(zh, "trips"); tr = np.nan_to_num(tr, nan=0.0)
        mt = dense_zone_how(zh, "mean_trips"); mt = np.nan_to_num(mt, nan=0.0)
        sp = dense_zone_how(zh, "speed_p50")
        small = (tr > 0) & (tr < K_MIN)
        supp[f"zone_hour_week/{s}"] = {"cells": int(small.sum()), "trips": int(tr[small].sum())}
        mt = np.where(small, np.nan, mt)
        sp = np.where((tr < K_MIN), np.nan, sp)
        mean_t[s], speed[s], trips_n[s] = rnd(mt, 2), rnd(sp, 1), tr
    zh = zone_how("all", "all")
    ff = cg.free_flow(zh)
    ci = cg.congestion_index(zh, ff)
    ratio = dense_zone_how(ci, "cong_idx")
    ffv = ff.to_dict(as_series=False)
    ffd = dict(zip(ffv["zone"], ffv["ff_mph"]))
    ff_arr = [None if ffd.get(z) is None else round(float(ffd[z]), 2) for z in ZONES]
    vref = zh.group_by("zone").agg(pl.col("mean_trips").quantile(0.95, "linear").alias("vref")).sort("zone")
    vref_arr = {z: v for z, v in zip(vref["zone"], vref["vref"])}
    bt = bpr.borough_table("all")
    bff = bpr.borough_ff(bt)
    return art({"mean_trips": "OBSERVED", "speed_mph": "DERIVED", "speed_ratio": "DERIVED", "free_flow_mph": "DERIVED"},
               layout="columnar, flat zone-major: index = zoneIndex*168 + how, how = dow*24 + hour (dow 0=Mon). zoneIndex = position in `zones`",
               zones=ZONES, services=SERVICES, how_count=168,
               mean_trips={s: mean_t[s] for s in SERVICES}, speed_mph={s: speed[s] for s in SERVICES},
               speed_ratio=rnd(ratio, 3),
               free_flow_mph=ff_arr, vref=[round(float(vref_arr.get(z, 0.0)), 3) for z in ZONES],
               borough_free_flow_mph={b: round(bff[b], 2) for b in bpr.BOROUGHS},
               definitions={"mean_trips": "trips per occurrence of that hour-of-week in 2024 (DST-aware denominators), pickup zone; null = suppressed (1..10 annual trips)",
                            "speed_mph": "median trip speed; null when fewer than 11 trips",
                            "speed_ratio": f"median speed / zone free-flow speed; null when cell has < {MIN_CELL} trips or zone free flow undefined",
                            "free_flow_mph": "p85 of the zone's hour-of-week median speeds over 02:00-05:59 (28 cells, each >= 30 trips, >= 14 valid cells), all services",
                            "vref": "p95 of the zone's 168 hourly mean trips (all services); used as the BPR capacity normalization"})


def build_zone_month(supp: dict) -> dict:
    zm = pq("zone_month")
    out = {}
    for col in ("pickups", "dropoffs"):
        out[col] = {}
        for s in ("yellow", "green", "fhvhv"):
            a = np.zeros((263, 12))
            for z, m, v in zip(*[zm.filter(pl.col("service") == s)[c].to_list() for c in ("zone", "month", col)]):
                a[ZIDX[z], m - 1] = v
            small = (a > 0) & (a < K_MIN)
            supp[f"zone_month/{col}/{s}"] = {"cells": int(small.sum()), "trips": int(a[small].sum())}
            out[col][s] = [None if small.ravel()[i] else int(v) for i, v in enumerate(a.ravel())]
    return art({"pickups": "OBSERVED", "dropoffs": "OBSERVED"}, layout="flat zone-major: index = zoneIndex*12 + (month-1); null = suppressed (1..10)",
               zones=ZONES, months=list(range(1, 13)), **out)


def od_frames():
    od = pq("od_band").with_columns((pl.col("band")).cast(pl.Int32))
    tot = pq("od_total")
    return od, tot


def build_od(supp: dict) -> tuple[dict, dict, dict]:
    od, tot = od_frames()
    bid = BAND_ORDER + ["all"]
    cols = ["o", "d", "band", "trips", "dur_p10_min", "dur_p50_min", "dur_p90_min", "spd_p10", "spd_p50", "spd_p90", "dist_mi"]
    rows = []
    e = od.filter(pl.col("o") != pl.col("d"))
    for b in range(6):
        s = e.filter(pl.col("band") == b)
        small = s.filter(pl.col("trips") < K_MIN)
        supp[f"od_top/{bid[b]}"] = {"cells": small.height, "trips": int(small["trips"].sum() or 0)}
        s = s.filter(pl.col("trips") >= K_MIN).sort(["trips", "o", "d"], descending=[True, False, False]).head(OD_TOP_ALL_N if b == 5 else OD_TOP_N)
        for r in s.iter_rows(named=True):
            rows.append([r["o"], r["d"], bid[b], r["trips"], round(r["dur_p10"] / 60, 1), round(r["dur_p50"] / 60, 1), round(r["dur_p90"] / 60, 1),
                         round(r["spd_p10"], 1), round(r["spd_p50"], 1), round(r["spd_p90"], 1), round(r["dist_p50"], 2)])
    od_top = art({"trips": "OBSERVED", "duration_min": "DERIVED", "speed_mph": "DERIVED"}, bands=BANDS_META, band_all_id="all",
                 definition=f"directed corridors (o != d), top {OD_TOP_N} per band and top {OD_TOP_ALL_N} for band 'all', cells >= {K_MIN} trips; quantiles exact over 2024 trips",
                 columns=cols, rows=rows)
    t = tot.filter(pl.col("trips") >= K_MIN).sort("o", "d")
    small = tot.filter(pl.col("trips") < K_MIN)
    supp["od_matrix_totals"] = {"cells": small.height, "trips": int(small["trips"].sum() or 0)}
    mt = art({"trips": "OBSERVED"}, columns=["o", "d", "trips"], note="pairs with >= 11 annual trips, includes o == d",
             o=t["o"].to_list(), d=t["d"].to_list(), trips=t["trips"].to_list())
    r = tot.filter(pl.col("o") != pl.col("d")).sort(["trips", "o", "d"], descending=[True, False, False]).head(RING_TOP_N)
    ring_top = art({"trips": "OBSERVED"}, columns=["o", "d", "trips"], note=f"top {RING_TOP_N} directed pairs, o != d, by annual trips",
                   rows=[[a, b, c] for a, b, c in zip(r["o"], r["d"], r["trips"])])
    return od_top, mt, ring_top


def cluster_label(r: dict) -> str:
    """Documented rule (METHODOLOGY): ratios of cluster centroid features to the citywide mean profile."""
    if r["night"] >= 1.4:
        return "Late-night weekend"
    if r["wkend"] >= 1.25:
        return "Weekend leisure"
    if r["am"] >= 1.1:
        return "Weekday commuter"
    if r["pm"] >= 1.05 and r["am"] <= 0.85:
        return "Evening-leaning core"
    return "All-day mixed"


def _feats(p: np.ndarray) -> dict:
    w = p.reshape(7, 24); n = w.sum()
    return {"night": (w[:, 22:].sum() + w[:, :6].sum()) / n, "wkend": w[5:].sum() / n, "am": w[:5, 6:10].sum() / n, "pm": w[:5, 16:20].sum() / n}


def build_clusters_network() -> tuple[dict, dict, dict]:
    zh = zone_how("all")
    zones_arr, m = dense_profiles(zh)
    tot = zh.group_by("zone").agg(pl.col("trips").sum().alias("t"))
    t = dict(zip(tot["zone"], tot["t"]))
    keep = np.array([t[z] >= MIN_ZONE_TRIPS for z in zones_arr])
    x = clustering.normalize(m[keep]); zk = zones_arr[keep]
    k, sil = clustering.select_k(x)
    lab = clustering.order_labels(clustering.fit(x, k), m[keep].sum(1))
    from sklearn.metrics import silhouette_score
    city = _feats(x.mean(0))
    cl = []
    used: dict[str, int] = {}
    for c in range(k):
        cen = x[lab == c].mean(0)
        f = _feats(cen)
        ratios = {n: float(f[n] / city[n]) for n in f}
        name = cluster_label(ratios)
        used[name] = used.get(name, 0) + 1
        if used[name] > 1:
            name = f"{name} {used[name]}"
        cl.append({"id": c, "label": name, "size": int((lab == c).sum()), "members": [int(z) for z in zk[lab == c]],
                   "share_of_trips": float(m[keep][lab == c].sum() / m[keep].sum()), "feature_ratios_vs_city": ratios,
                   "centroid": [round(float(v), 6) for v in cen]})
    stab = clustering.stability(x, k)
    clusters = art({"profile": "DERIVED", "labels": "DERIVED", "silhouette": "DERIVED"}, k=k, silhouette=float(sil[k]),
                   silhouette_by_k={str(a): float(b) for a, b in sil.items()}, stability_ari=stab,
                   random_label_silhouette=clustering.random_baseline(x, lab),
                   min_zone_trips=MIN_ZONE_TRIPS, excluded_zones=sorted(set(ZONES) - {int(z) for z in zk}),
                   features="L1-normalized 168-hour weekly pickup profile (all services), k-means n_init=10 seed=%d" % clustering.SEED,
                   label_rule="night>=1.4x city (share of trips 22:00-05:59) -> Late-night weekend; weekend share>=1.25x -> Weekend leisure; weekday 06-09 share>=1.1x -> Weekday commuter; weekday 16-19 share>=1.05x and 06-09 <=0.85x -> Evening-leaning core; else All-day mixed",
                   clusters=cl)
    zc = {int(z): int(l) for z, l in zip(zk, lab)}
    g = network.build_graph(pq("od_total"))
    nm = network.metrics(g, ZONES)
    rows = [{"zone": r["zone"], "pagerank": r["pagerank"], "in_strength": int(r["in_strength"]), "out_strength": int(r["out_strength"]),
             "betweenness": r["betweenness"], "cluster": zc.get(r["zone"])} for r in nm.iter_rows(named=True)]
    net = art({"pagerank": "DERIVED", "strength": "DERIVED", "betweenness": "DERIVED", "cluster": "DERIVED"},
              method="directed OD graph, known zones, o != d, pairs >= 11 trips; PageRank alpha=.85 weight=trips; betweenness exact, edge length = 1/trips, normalized",
              n_edges=g.number_of_edges(), nodes=rows)
    return clusters, net, nm.to_dict(as_series=False)


def build_daily_weather() -> tuple[dict, dict]:
    d = pq("daily")
    w = weather.load_weather()
    days = [dt.date(2024, 1, 1) + dt.timedelta(i) for i in range(366)]
    piv = {s: {r["date"]: r["trips"] for r in d.filter(pl.col("service") == s).iter_rows(named=True)} for s in ("yellow", "green", "fhvhv")}
    wd = {r["date"]: r for r in w.iter_rows(named=True)}
    daily = art({"trips": "OBSERVED", "weather": "OBSERVED"}, station="USW00094728 Central Park (NOAA GHCN-Daily)",
                units={"prcp_mm": "mm", "tmax_c": "C", "tmin_c": "C", "snow_mm": "mm"}, date=[x.isoformat() for x in days],
                trips={s: [piv[s].get(x, 0) for x in days] for s in piv},
                prcp_mm=[wd[x]["prcp_mm"] if x in wd else None for x in days], tmax_c=[wd[x]["tmax_c"] if x in wd else None for x in days],
                tmin_c=[wd[x]["tmin_c"] if x in wd else None for x in days], snow_mm=[wd[x]["snow_mm"] if x in wd else None for x in days])
    total = d.group_by("date").agg(pl.col("trips").sum())
    bins = weather.fit(total, w)
    cont = weather.fit(total, w, continuous=True)
    pc = next(c for c in cont["coefficients"] if c["term"] == "prcp_per_mm")
    eff = lambda b: float(np.expm1(10 * b))
    wm = art({"coefficients": "DERIVED"}, association_only=True,
             note="Association, not causation. Single station applied citywide; dependent variable is log(daily kept trips, all services).",
             coefficient_fields="beta/se/ci_lo/ci_hi are on the log-trips scale; pct_effect = exp(beta)-1 (per unit of the term); p is HAC two-sided",
             primary="continuous", models={"bins": bins, "continuous": cont},
             prcp_effect_10mm={"spec": "log; continuous PRCP (mm)", "pct": 100 * eff(pc["beta"]), "ci_low_pct": 100 * eff(pc["ci_lo"]), "ci_high_pct": 100 * eff(pc["ci_hi"])})
    return daily, wm


def build_bpr(supp: dict) -> tuple[dict, dict]:
    val = validate.bpr_holdout()
    rob = validate.ff_robustness()
    obs = bpr.borough_obs("all")
    zob, zff, zvref = bpr.zone_obs_by_borough("all")
    out, vec = {}, []
    for b in bpr.BOROUGHS:
        o = obs[b]; df = o["df"]
        x, y = df["x"].to_numpy(), df["y"].to_numpy()
        f = bpr.fit_curve(x, y)
        order = np.argsort(x); bins = np.array_split(order, 24)
        binned = [{"x": round(float(x[i].mean()), 4), "tti": round(float(y[i].mean()), 4), "n": int(len(i))} for i in bins]
        # v and median_speed_mph at full float precision: the site's live BPR lab feeds them straight into
        # scenario_speed, and must match bpr_test_vectors.json (which uses the unrounded values) at 1e-9
        base = [{"how": int(h), "v": float(v), "x": round(float(xx), 4), "median_speed_mph": float(s), "median_trip_min": round(float(dm), 2),
                 "tti": round(float(yy), 4), "fitted_speed_mph": round(bpr.fitted_speed(o["ff"], v, f.alpha, f.beta, o["vref"]), 2)}
                for h, v, xx, s, dm, yy in zip(df["how"], df["v"], df["x"], df["speed_p50"], df["dur_min"], df["y"])]
        zdf = zob[b]; zx, zy = zdf["x"].to_numpy(), zdf["y"].to_numpy()
        zf = bpr.fit_curve(zx, zy)
        zo = np.argsort(zx); zbins = np.array_split(zo, 30)
        out[b] = {"t0_min_per_mile": round(60.0 / o["ff"], 4), "free_flow_mph": round(o["ff"], 3), "alpha": f.alpha, "beta": f.beta,
                  "capacity_index": o["vref"], "capacity_units": "trips/hour (p95 of the borough's 168 hourly volumes)",
                  "rmse": f.rmse, "r2": f.r2, "n": f.n, "x_max_observed": f.x_max, "binned_points": binned, "baseline": base,
                  "zone_level": {"alpha": zf.alpha, "beta": zf.beta, "rmse": zf.rmse, "r2": zf.r2, "n": zf.n, "x_max_observed": zf.x_max,
                                 "binned_points": [{"x": round(float(zx[i].mean()), 4), "tti": round(float(zy[i].mean()), 4), "n": int(len(i))} for i in zbins]},
                  "holdout": {"borough_level": val["borough_level"][b], "zone_level": val["zone_level"][b]}}
        peak = int(np.argmax(x))
        combos = [(1, 1), (1.2, 1), (0.8, 1), (1, 1.25), (1, 0.75), (2, 1), (1.5, 0.5), (3, 1), (1.1, 1.1)]
        for how in (peak, int(np.argsort(x)[len(x) // 2]), int(np.argmin(x))):
            r = df.filter(pl.col("how") == how).row(0, named=True)
            for dm, cm in combos:
                vec.append(_vector(f"{b}/borough/how{how}", r["speed_p50"], o["ff"], r["v"], o["vref"], f.alpha, f.beta, dm, cm))
    # zone-level vectors (borough zone-pooled params, zone C = zone vref) for two busy zones
    zh = zone_how("all")
    for zid, bname in ((230, "Manhattan"), (132, "Queens")):
        zr = zh.filter((pl.col("zone") == zid)).sort("trips", descending=True).row(0, named=True)
        ffz = float(zff.filter(pl.col("zone") == zid)["ff_mph"][0]); vr = float(zvref.filter(pl.col("zone") == zid)["vref"][0])
        zp = out[bname]["zone_level"]
        for dm, cm in [(1, 1), (1.3, 1), (1, 0.8), (2, 0.5)]:
            vec.append(_vector(f"{bname}/zone{zid}/how{zr['how']}", zr["speed_p50"], ffz, zr["mean_trips"], vr, zp["alpha"], zp["beta"], dm, cm))
    fit = art({"free_flow_mph": "DERIVED", "alpha_beta": "DERIVED", "baseline": "OBSERVED", "binned_points": "DERIVED", "scenario": "SIMULATED"},
              model="t = t0 * (1 + alpha * (v/C)^beta); TTI = t/t0 = ff_mph / median_speed_mph; v = mean trips per hour (all services, pickup in borough); C = capacity_index = p95 of the 168 hourly v",
              identifiability="C is fixed to the p95 hourly volume (a normalization, not engineered road capacity); alpha and beta are fitted by bounded nonlinear least squares (alpha in [0,50], beta in [0.2,10]).",
              scenario_functions={"scenario_speed": "obs_speed * (1 + alpha (v/C)^beta) / (1 + alpha (v*dm/(C*cm))^beta)  (anchored: exactly obs_speed at dm=cm=1)",
                                  "scenario_fitted_speed": "ff / (1 + alpha (v*dm/(C*cm))^beta)  (equals the fitted baseline at dm=cm=1)"},
              free_flow_definition="p85 of the 28 hour-of-week median speeds over 02:00-05:59 with >= 30 trips each",
              robustness_free_flow=rob, boroughs=out)
    vectors = art({"expected": "SIMULATED"}, tolerance_rel=1e-9, functions=["scenario_speed", "scenario_fitted_speed"],
                  note="Parity vectors generated by analytics/bpr.py. inputs: obs_speed_mph, ff_mph, v, c, alpha, beta, demand_mult, capacity_mult", vectors=vec)
    return fit, vectors


def _vector(case, obs_speed, ff, v, c, alpha, beta, dm, cm) -> dict:
    inp = {"obs_speed_mph": float(obs_speed), "ff_mph": float(ff), "v": float(v), "c": float(c), "alpha": float(alpha), "beta": float(beta),
           "demand_mult": float(dm), "capacity_mult": float(cm)}
    return {"case": case, "inputs": inp,
            "expected": {"fitted_speed_mph": bpr.fitted_speed(ff, v, alpha, beta, c),
                         "scenario_speed_mph": bpr.scenario_speed(obs_speed, v, c, alpha, beta, dm, cm),
                         "scenario_fitted_speed_mph": bpr.scenario_fitted_speed(ff, v, c, alpha, beta, dm, cm)}}


def build_reconciliation(supp: dict) -> dict:
    led = load_ledger()
    rows = []
    for k in sorted(led):
        r = led[k]
        rows.append({"service": r["service"], "month": r["month"], "raw_rows": r["raw_rows"], "kept": r["kept"], "exclusions": r["exclusions"],
                     "unknown_pu": r["unknown_pu"], "unknown_do": r["unknown_do"], "unknown_od": r["unknown_od"], "kept_known_od": r["kept_known_od"],
                     "trip_time_mismatch_gt60s": r["trip_time_mismatch_gt60s"]})
    sup_cells = sum(v["cells"] for v in supp.values())
    return art({"counts": "OBSERVED", "suppression": "DERIVED"},
               invariant="raw_rows == kept + sum(exclusions) per service-month; unknown-zone rows stay in kept",
               rows=rows, suppression=supp, suppressed_cells_total=sup_cells,
               suppressed_trips_total=supp["od_matrix_totals"]["trips"],
               suppressed_trips_definition="annual trips in OD pairs (known zones) with < 11 trips, the pairs withheld from od_matrix_totals.json; per-artifact figures are in `suppression` (artifacts overlap, do not add them)")


def build_facts(nm: dict, clusters: dict, wm: dict, rec: dict) -> dict:
    led = rec["rows"]
    kept = sum(r["kept"] for r in led); raw = sum(r["raw_rows"] for r in led)
    exc = sum(sum(r["exclusions"].values()) for r in led)
    share = {s: 100 * sum(r["kept"] for r in led if r["service"] == s) / kept for s in ("fhvhv", "yellow", "green")}
    zh = zone_how("all")
    best = zh.sort("mean_trips", descending=True).row(0, named=True)
    zd = zone_dim(); zname = dict(zip(zd["zone"], zd["name"])); zbor = dict(zip(zd["zone"], zd["borough"]))
    city = zh.group_by("dow", "hour").agg(pl.col("mean_trips").sum().alias("v"))
    wk = city.filter(pl.col("dow") < 5).group_by("hour").agg(pl.col("v").mean()).sort("hour")
    we = city.filter(pl.col("dow") >= 5).group_by("hour").agg(pl.col("v").mean()).sort("hour")
    peak = lambda df, lo, hi: int(df.filter(pl.col("hour").is_between(lo, hi)).sort("v", descending=True)["hour"][0])
    am, pm, wep = peak(wk, 5, 11), peak(wk, 15, 21), int(we.sort("v", descending=True)["hour"][0])
    tot = pq("od_total")
    def internal(b):
        zs = [z for z in ZONES if zbor[z] == b]
        t = tot.with_columns(pl.col("o").is_in(zs).alias("oi"), pl.col("d").is_in(zs).alias("di"))
        return 100 * t.filter(pl.col("oi") & pl.col("di"))["trips"].sum() / t.filter(pl.col("oi"))["trips"].sum()
    air = tot.filter(pl.col("o").is_in([132, 138]))["d"].n_unique()
    zmon = pq("zone_month").group_by("zone").agg(pl.col("pickups").sum().alias("p")).sort("p", descending=True)
    cum = np.cumsum(zmon["p"].to_numpy()) / zmon["p"].sum()
    half = int(np.searchsorted(cum, 0.5) + 1)
    hinge = max(zip(nm["betweenness"], nm["zone"]))[1]
    te = tot.filter(pl.col("o") != pl.col("d")).sort(["trips", "o", "d"], descending=[True, False, False]).row(0, named=True)
    ta = tot.sort(["trips", "o", "d"], descending=[True, False, False]).row(0, named=True)
    bt = bpr.borough_table("all"); bff = bpr.borough_ff(bt)
    amr = {}
    for b in bpr.BOROUGHS:
        s = bt.filter((pl.col("borough") == b) & (pl.col("dow") < 5) & pl.col("hour").is_between(6, 9))["speed_p50"]
        amr[b] = {"am_peak_median_speed_mph": float(s.median()), "free_flow_mph": bff[b], "speed_ratio_pct": 100 * float(s.median()) / bff[b]}
    pe = wm["prcp_effect_10mm"]
    days = 366
    return art({"headline_numbers": "DERIVED"},
               trips_kept_total=kept, raw_rows_total=raw, excluded_total=exc, share_pct={k: round(v, 3) for k, v in share.items()},
               trips_per_minute_mean=kept / (days * 1440),
               busiest_zone_how={"zone": best["zone"], "name": zname[best["zone"]], "how": best["how"], "how_label": how_label(best["how"]), "mean_trips": best["mean_trips"]},
               am_peak_hour={"hour": am, "label": hour_label(am)}, pm_peak_hour={"hour": pm, "label": hour_label(pm)}, weekend_peak_hour={"hour": wep, "label": hour_label(wep)},
               mn_internal_share_pct=internal("Manhattan"), bk_internal_share_pct=internal("Brooklyn"),
               airport_dest_zone_count=int(air), airport_origin_zones=[132, 138],
               zones_for_half_pickups=half, hinge_zone={"zone": hinge, "name": zname[hinge]},
               top_od_pair={"o": te["o"], "d": te["d"], "o_name": zname[te["o"]], "d_name": zname[te["d"]], "trips": te["trips"], "note": "o != d"},
               top_od_pair_incl_intrazone={"o": ta["o"], "d": ta["d"], "trips": ta["trips"]},
               suppressed_cells_total=rec["suppressed_cells_total"], suppressed_trips_total=rec["suppressed_trips_total"],
               clusters={"k": clusters["k"], "silhouette": clusters["silhouette"]}, borough_am_peak_speed_ratio=amr,
               weather_prcp_effect_10mm={"spec": pe["spec"] + "; log(daily trips) ~ PRCP + snow + TMAX + dow + month + holiday; HAC(7) 95% CI", **{k: pe[k] for k in ("pct", "ci_low_pct", "ci_high_pct")}},
               provenance="shares and airport count computed from pre-suppression aggregates of the interim trips (od_total.parquet), not from published artifacts")


def build_meta(sizes: dict, zinfo: dict) -> dict:
    man = json.loads((MANIFESTS / "raw_manifest.json").read_text())
    gen = max(v.get("retrieved_at") or "" for v in man.values())
    srcs = {}
    for p, v in sorted(man.items()):
        s = srcs.setdefault(v["kind"], {"files": 0, "bytes": 0})
        s["files"] += 1; s["bytes"] += v["bytes"]
    return art({"all": "OBSERVED"}, pipeline_version=PIPELINE_VERSION, generated_at=gen, generated_at_note="latest raw retrieval time (deterministic across reruns)",
               sources=srcs, bands=BANDS_META, zones_simplify_tolerance_deg=zones.SIMPLIFY_DEG, zones_geojson_bytes=zinfo["bytes"],
               small_cell_threshold=K_MIN, min_zone_trips_clustering=MIN_ZONE_TRIPS, min_cell_trips_speed=MIN_CELL,
               timezone_note="timestamps are naive America/New_York wall clock; 2024-03-10 lacks 02:00, 2024-11-03 repeats 01:00",
               artifact_tags={"zones.geojson": "OBSERVED", "zones_index.json": "DERIVED", "zone_hour_week.json": "OBSERVED/DERIVED", "zone_month.json": "OBSERVED",
                              "od_top.json": "OBSERVED/DERIVED", "od_matrix_totals.json": "OBSERVED", "od_ring_top.json": "OBSERVED", "network.json": "DERIVED",
                              "clusters.json": "DERIVED", "daily.json": "OBSERVED", "weather_model.json": "DERIVED", "bpr_fit.json": "DERIVED/SIMULATED",
                              "bpr_test_vectors.json": "SIMULATED", "reconciliation.json": "OBSERVED", "validation.json": "DERIVED", "facts.json": "DERIVED"},
               artifact_bytes=sizes)


def build_all() -> dict:
    zinfo = zones.build()
    supp: dict = {}
    fc = json.loads((PUBLIC / "zones.geojson").read_text())
    zrecs = [f["properties"] for f in fc["features"]]
    zi = ring.ring_index(zrecs)
    arts = {"zones_index.json": art({"ring": "DERIVED", "centroid": "DERIVED"}, ring_rule="docs/DATA_CONTRACTS.md (DR-1)", gap_deg=ring.GAP_DEG,
                                   borough_order=ring.BOROUGH_ORDER, zones=zi)}
    arts["zone_hour_week.json"] = build_zone_hour_week(supp)
    arts["zone_month.json"] = build_zone_month(supp)
    arts["od_top.json"], arts["od_matrix_totals.json"], arts["od_ring_top.json"] = build_od(supp)
    arts["clusters.json"], arts["network.json"], nm = build_clusters_network()
    arts["daily.json"], arts["weather_model.json"] = build_daily_weather()
    arts["bpr_fit.json"], arts["bpr_test_vectors.json"] = build_bpr(supp)
    arts["reconciliation.json"] = build_reconciliation(supp)
    arts["facts.json"] = build_facts(nm, arts["clusters.json"], arts["weather_model.json"], arts["reconciliation.json"])
    arts["validation.json"] = art({"validation": "DERIVED"}, **validate.run())
    sizes = {"zones.geojson": zinfo["bytes"]}
    for name, obj in arts.items():
        sizes[name] = write_json(PUBLIC / name, py(obj))
    meta = build_meta(sizes, zinfo)
    sizes["meta.json"] = write_json(PUBLIC / "meta.json", py(meta))
    gz = {n: len(gzip.compress((PUBLIC / n).read_bytes(), 6)) for n in sizes}
    meta["artifact_bytes_gzip"] = gz
    write_json(PUBLIC / "meta.json", py(meta))
    return {"bytes": sizes, "gzip": gz}


if __name__ == "__main__":
    r = build_all()
    for n in sorted(r["bytes"]):
        print(f"{n:28s} {r['bytes'][n]:>10,}  gz {r['gzip'][n]:>9,}")
    print("total", sum(r["bytes"].values()), "gz", sum(r["gzip"].values()))
