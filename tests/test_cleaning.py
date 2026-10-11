"""Cleaning rules, time bucketing (incl. DST) and coordinate transforms on small fixtures."""
import datetime as dt

import duckdb
import pytest

from pipelines.cleaning import clean
from pipelines.common import BANDS, band_case_sql
from pipelines.modeling import ring, zones

T = dt.datetime


def make_fixture(tmp_path, monkeypatch):
    raw = tmp_path / "raw"; (raw / "tlc" / "yellow").mkdir(parents=True)
    rows = [  # pickup, dropoff, dist, pu, do
        (T(2024, 3, 10, 1, 59), T(2024, 3, 10, 3, 5), 5.0, 132, 230),      # kept (DST spring)
        (T(2024, 3, 10, 3, 0), T(2024, 3, 10, 3, 20), 4.0, 43, 264),       # kept, unknown do
        (T(2024, 3, 31, 23, 59), T(2024, 4, 1, 0, 30), 3.0, 1, 2),         # kept, crosses month end
        (None, T(2024, 3, 2, 0, 0), 1.0, 1, 2),                             # null_timestamp
        (T(2023, 12, 31, 23, 0), T(2024, 1, 1, 0, 10), 1.0, 1, 2),          # ts_out_of_month
        (T(2024, 3, 5, 10, 0), T(2024, 3, 5, 10, 0), 1.0, 1, 2),            # nonpositive_duration
        (T(2024, 3, 5, 10, 0), T(2024, 3, 5, 10, 0, 30), 1.0, 1, 2),        # bad_duration (<60s)
        (T(2024, 3, 5, 10, 0), T(2024, 3, 6, 10, 0), 9.0, 1, 2),            # bad_duration (>6h)
        (T(2024, 3, 5, 10, 0), T(2024, 3, 5, 10, 30), 0.0, 1, 2),           # bad_distance
        (T(2024, 3, 5, 10, 0), T(2024, 3, 5, 10, 30), 250.0, 1, 2),         # bad_distance
        (T(2024, 3, 5, 10, 0), T(2024, 3, 5, 10, 10), 30.0, 1, 2),          # implausible_speed (180 mph)
    ]
    con = duckdb.connect()
    con.execute("create table s(tpep_pickup_datetime timestamp, tpep_dropoff_datetime timestamp, trip_distance double, PULocationID int, DOLocationID int)")
    con.executemany("insert into s values (?,?,?,?,?)", rows)
    con.execute(f"copy s to '{raw / 'tlc' / 'yellow' / 'yellow_tripdata_2024-03.parquet'}' (format parquet)")
    monkeypatch.setattr(clean, "RAW", raw)
    monkeypatch.setattr(clean, "INTERIM", tmp_path / "interim")
    return len(rows)


def test_exclusion_rules_and_invariant(tmp_path, monkeypatch):
    n = make_fixture(tmp_path, monkeypatch)
    r = clean.clean_one(duckdb.connect(), "yellow", 3)
    assert r["raw_rows"] == n == r["kept"] + sum(r["exclusions"].values())
    assert r["exclusions"] == {"null_timestamp": 1, "ts_out_of_month": 1, "nonpositive_duration": 1, "bad_duration": 2, "bad_distance": 2, "implausible_speed": 1}
    assert r["kept"] == 3 and r["unknown_do"] == 1 and r["unknown_pu"] == 0 and r["unknown_od"] == 1 and r["kept_known_od"] == 2


def test_time_bucketing_dst(tmp_path, monkeypatch):
    make_fixture(tmp_path, monkeypatch)
    clean.clean_one(duckdb.connect(), "yellow", 3)
    out = duckdb.sql(f"select hour_local, dow, date_local, speed_mph from read_parquet('{tmp_path}/interim/service=yellow/month=03/part.parquet') order by pickup_ts").fetchall()
    assert out[0][:3] == (1, 6, dt.date(2024, 3, 10))        # 2024-03-10 is a Sunday; wall-clock hour 1 kept as-is
    assert out[1][:3] == (3, 6, dt.date(2024, 3, 10))        # hour 2 never occurs
    assert out[2][:3] == (23, 6, dt.date(2024, 3, 31))
    assert abs(out[0][3] - 5.0 / (66 * 60 / 3600)) < 1e-3     # duration is wall-clock difference


def test_fall_back_repeated_hour():
    # naive timestamps cannot distinguish the repeated 01:00 hour of 2024-11-03: both land in hour 1 of Sunday
    r = duckdb.sql("select hour(ts), isodow(ts)-1, cast(ts as date) from (values (timestamp '2024-11-03 01:10:00'), (timestamp '2024-11-03 01:50:00')) t(ts)").fetchall()
    assert r == [(1, 6, dt.date(2024, 11, 3))] * 2


def test_band_sql_matches_definition():
    for h in range(24):
        idx = duckdb.sql(f"select {band_case_sql(str(h))}").fetchone()[0]
        lo, hi = list(BANDS.values())[idx]
        assert lo <= h <= hi


def test_coordinate_transform_known_places(art):
    known = {132: (-73.7781, 40.6413), 230: (-73.9855, 40.7580), 43: (-73.9654, 40.7829)}  # JFK, Times Sq, Central Park
    f = {x["id"]: x["properties"] for x in art("zones.geojson")["features"]}
    for zid, (lon, lat) in known.items():
        assert abs(f[zid]["cx"] - lon) < 0.03 and abs(f[zid]["cy"] - lat) < 0.03, zid


def test_state_plane_transform_point():
    # EPSG:2263 origin-ish check: Times Square is ~ (988,500 ft E, 215,800 ft N)
    lon, lat = zones.to_wgs84(988500.0, 215800.0)
    assert abs(lon + 73.9855) < 0.01 and abs(lat - 40.758) < 0.01


def test_ring_order_rule(art):
    z = art("zones_index.json")["zones"]
    assert [r["ring_index"] for r in z] == list(range(263))
    assert z[0]["borough"] == "Manhattan"
    order = [r["borough"] for r in z]
    first = [b for i, b in enumerate(order) if i == 0 or order[i - 1] != b]
    assert first == ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island", "EWR"]
    span = (360 - 6 * 1.5) / 263
    for a, b in zip(z, z[1:]):
        step = b["ring_angle_deg"] - a["ring_angle_deg"]
        assert abs(step - (span + (1.5 if a["borough"] != b["borough"] else 0))) < 1e-3
    assert abs(z[0]["ring_angle_deg"] - span / 2) < 1e-3 and z[-1]["ring_angle_deg"] < 360
    # deterministic: recomputing from geojson gives identical output
    props = [f["properties"] for f in art("zones.geojson")["features"]]
    assert ring.ring_index(props) == z
    # within-borough clockwise angle from north is non-decreasing
    import math
    m = [r for r in z if r["borough"] == "Manhattan"]
    mlon, mlat = sum(r["lon"] for r in m) / len(m), sum(r["lat"] for r in m) / len(m)
    k = math.cos(math.radians(mlat))
    ang = [math.degrees(math.atan2((r["lon"] - mlon) * k, r["lat"] - mlat)) % 360 for r in m]
    assert ang == sorted(ang)
