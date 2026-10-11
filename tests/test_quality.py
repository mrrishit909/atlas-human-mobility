"""Schema/null/uniqueness/referential/range checks on published artifacts."""
import numpy as np


def zone_ids(art):
    return {f["properties"]["id"] for f in art("zones.geojson")["features"]}


def test_zones_complete_and_unique(art):
    ids = [f["id"] for f in art("zones.geojson")["features"]]
    assert sorted(ids) == list(range(1, 264))
    assert all(f["properties"]["id"] == f["id"] for f in art("zones.geojson")["features"])


def test_referential_integrity(art):
    z = zone_ids(art)
    assert set(art("zone_hour_week.json")["zones"]) == z
    assert set(art("zone_month.json")["zones"]) == z
    assert {n["zone"] for n in art("network.json")["nodes"]} == z
    assert {r["LocationID"] for r in art("zones_index.json")["zones"]} == z
    mt = art("od_matrix_totals.json")
    assert set(mt["o"]) | set(mt["d"]) <= z
    assert all({r[0], r[1]} <= z for r in art("od_top.json")["rows"])
    assert all({r[0], r[1]} <= z for r in art("od_ring_top.json")["rows"])
    cl = art("clusters.json")
    mem = [m for c in cl["clusters"] for m in c["members"]]
    assert len(mem) == len(set(mem)) and set(mem) | set(cl["excluded_zones"]) == z


def test_key_uniqueness(art):
    mt = art("od_matrix_totals.json")
    pairs = list(zip(mt["o"], mt["d"]))
    assert len(pairs) == len(set(pairs))
    rows = art("od_top.json")["rows"]
    keys = [(r[0], r[1], r[2]) for r in rows]
    assert len(keys) == len(set(keys))
    assert len(art("daily.json")["date"]) == len(set(art("daily.json")["date"])) == 366


def test_suppression_floor(art):
    assert min(art("od_matrix_totals.json")["trips"]) >= 11
    assert all(r[3] >= 11 for r in art("od_top.json")["rows"])
    for s in ("yellow", "green", "fhvhv"):
        assert all(v is None or v == 0 or v >= 11 for v in art("zone_month.json")["pickups"][s])


def test_value_ranges(art):
    zh = art("zone_hour_week.json")
    for s in zh["services"]:
        sp = np.array([v for v in zh["speed_mph"][s] if v is not None])
        assert sp.min() > 0 and sp.max() <= 80
        assert min(v for v in zh["mean_trips"][s] if v is not None) >= 0
    r = np.array([v for v in zh["speed_ratio"] if v is not None])
    assert 0.1 < r.min() and r.max() < 5
    for row in art("od_top.json")["rows"]:
        assert row[4] <= row[5] <= row[6] and row[7] <= row[8] <= row[9]
        assert 0 < row[8] <= 80 and row[10] > 0
    d = art("daily.json")
    assert all(40 < v < 2e6 for v in map(sum, zip(*d["trips"].values())))
    net = art("network.json")["nodes"]
    assert abs(sum(n["pagerank"] for n in net) - 1) < 1e-6
    assert all(0 <= n["betweenness"] <= 1 for n in net)


def test_clusters_sane(art):
    c = art("clusters.json")
    assert 3 <= c["k"] <= 8 and c["silhouette"] > c["random_label_silhouette"]["max"]
    assert c["stability_ari"]["ari_mean"] > 0.8
    labels = [x["label"] for x in c["clusters"]]
    assert len(labels) == len(set(labels)) and all(2 <= len(l.split()) <= 4 for l in labels)
    for x in c["clusters"]:
        assert abs(sum(x["centroid"]) - 1) < 1e-4 and len(x["centroid"]) == 168
