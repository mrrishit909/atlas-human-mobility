import duckdb
import pytest

from pipelines.cleaning.clean import RULE_ORDER
from pipelines.common import INTERIM, RAW


def test_ledger_invariant_exact(ledger):
    assert len(ledger) == 36
    for k, r in ledger.items():
        assert set(r["exclusions"]) == set(RULE_ORDER)
        assert r["raw_rows"] == r["kept"] + sum(r["exclusions"].values()), k
        assert r["unknown_od"] >= max(r["unknown_pu"], r["unknown_do"]) and r["kept_known_od"] == r["kept"] - r["unknown_od"]


def test_reconciliation_json_matches_ledger(art, ledger):
    rows = art("reconciliation.json")["rows"]
    assert len(rows) == len(ledger)
    for r in rows:
        L = ledger[f"{r['service']}-2024-{r['month']:02d}"]
        assert (r["raw_rows"], r["kept"], r["exclusions"]) == (L["raw_rows"], L["kept"], L["exclusions"])
        assert r["raw_rows"] == r["kept"] + sum(r["exclusions"].values())


def test_zone_month_reconciles(art):
    rec = art("reconciliation.json")
    zm = art("zone_month.json")
    supp = rec["suppression"]
    for s in ("yellow", "green", "fhvhv"):
        rows = [r for r in rec["rows"] if r["service"] == s]
        for col, unk in (("pickups", "unknown_pu"), ("dropoffs", "unknown_do")):
            pub = sum(v for v in zm[col][s] if v is not None)
            assert pub + supp[f"zone_month/{col}/{s}"]["trips"] + sum(r[unk] for r in rows) == sum(r["kept"] for r in rows), (s, col)
        # per month too
        for m in range(1, 13):
            r = next(r for r in rows if r["month"] == m)
            col = [zm["pickups"][s][i * 12 + m - 1] for i in range(263)]
            assert sum(v for v in col if v) <= r["kept"] - r["unknown_pu"]


def test_od_matrix_reconciles(art):
    rec = art("reconciliation.json")
    mt = art("od_matrix_totals.json")
    assert sum(mt["trips"]) + rec["suppressed_trips_total"] == sum(r["kept_known_od"] for r in rec["rows"])


def test_daily_reconciles(art):
    rec = art("reconciliation.json")
    d = art("daily.json")
    for s in ("yellow", "green", "fhvhv"):
        assert sum(d["trips"][s]) == sum(r["kept"] for r in rec["rows"] if r["service"] == s)


def test_zone_hour_week_reconciles(art):
    rec = art("reconciliation.json")
    zh = art("zone_hour_week.json")
    assert zh["services"][0] == "all"
    # mean_trips * n_dates is not stored, so check magnitude: citywide mean/hour * 8784 h ~ known-pickup trips
    tot_known_pu = sum(r["kept"] - r["unknown_pu"] for r in rec["rows"])
    est = sum(v for v in zh["mean_trips"]["all"] if v) * (366 * 24 / 168)
    assert abs(est - tot_known_pu) / tot_known_pu < 0.02


def test_facts_consistent(art):
    f, rec = art("facts.json"), art("reconciliation.json")
    assert f["trips_kept_total"] == sum(r["kept"] for r in rec["rows"])
    assert f["raw_rows_total"] == sum(r["raw_rows"] for r in rec["rows"])
    assert f["raw_rows_total"] == f["trips_kept_total"] + f["excluded_total"]
    assert abs(sum(f["share_pct"].values()) - 100) < 1e-6
    assert abs(f["trips_per_minute_mean"] - f["trips_kept_total"] / 527040) < 1e-6
    assert f["suppressed_trips_total"] == rec["suppressed_trips_total"]
    assert f["clusters"]["k"] == art("clusters.json")["k"]
    assert 5 <= f["am_peak_hour"]["hour"] <= 11 and 15 <= f["pm_peak_hour"]["hour"] <= 21
    top = art("od_ring_top.json")["rows"][0]
    assert [f["top_od_pair"]["o"], f["top_od_pair"]["d"], f["top_od_pair"]["trips"]] == top
    bet = {n["zone"]: n["betweenness"] for n in art("network.json")["nodes"]}
    assert f["hinge_zone"]["zone"] == max(bet, key=bet.get)
    assert 0 < f["mn_internal_share_pct"] < 100 and 0 < f["airport_dest_zone_count"] <= 263
    # precip effect equals exp(10*beta)-1 of the continuous model
    import math
    w = art("weather_model.json")
    c = next(c for c in w["models"]["continuous"]["coefficients"] if c["term"] == "prcp_per_mm")
    assert abs(f["weather_prcp_effect_10mm"]["pct"] - 100 * math.expm1(10 * c["beta"])) < 1e-9
    assert f["weather_prcp_effect_10mm"]["ci_low_pct"] < f["weather_prcp_effect_10mm"]["pct"] < f["weather_prcp_effect_10mm"]["ci_high_pct"]


@pytest.mark.slow
def test_interim_and_raw_counts_match_ledger(ledger):
    con = duckdb.connect()
    for k, r in ledger.items():
        service, _, mm = k.split("-")
        kept = con.execute(f"select count(*) from read_parquet('{INTERIM}/service={service}/month={mm}/part.parquet')").fetchone()[0]
        raw = con.execute(f"select count(*) from read_parquet('{RAW}/tlc/{service}/{service}_tripdata_2024-{mm}.parquet')").fetchone()[0]
        assert kept == r["kept"] and raw == r["raw_rows"], k
