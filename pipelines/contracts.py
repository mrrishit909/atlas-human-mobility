"""Generate JSON Schemas (draft 2020-12) for every published artifact into data/contracts/*.schema.json."""
from __future__ import annotations

import json

from pipelines.common import CONTRACTS

N, I, S, B = {"type": "number"}, {"type": "integer"}, {"type": "string"}, {"type": "boolean"}
NN = {"type": ["number", "null"]}
IN = {"type": ["integer", "null"]}
TAGS = {"type": "object", "minProperties": 1, "additionalProperties": {"type": "string", "pattern": "^(OBSERVED|DERIVED|PREDICTED|SIMULATED)(/(OBSERVED|DERIVED|PREDICTED|SIMULATED))*$"}}


def arr(item, n=None, lo=None):
    d = {"type": "array", "items": item}
    if n is not None:
        d["minItems"] = d["maxItems"] = n
    elif lo is not None:
        d["minItems"] = lo
    return d


def obj(props: dict, req: list | None = None, extra: bool = True) -> dict:
    return {"type": "object", "properties": props, "required": req if req is not None else list(props), "additionalProperties": extra}


def top(name: str, props: dict, req: list | None = None) -> dict:
    p = {"schema_version": {"const": "v1"}, "tags": TAGS, **props}
    r = ["schema_version", "tags"] + (req if req is not None else list(props))
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "title": name, **obj(p, r)}


SERV = ["all", "yellow", "green", "fhvhv"]
SCHEMAS = {
    "zones_index": top("zones_index", {"ring_rule": S, "gap_deg": N, "borough_order": arr(S), "zones": arr(obj({
        "LocationID": {"type": "integer", "minimum": 1, "maximum": 263}, "name": S, "borough": S, "lon": {"type": "number", "minimum": -75, "maximum": -73},
        "lat": {"type": "number", "minimum": 40, "maximum": 41}, "ring_index": {"type": "integer", "minimum": 0, "maximum": 262},
        "ring_angle_deg": {"type": "number", "minimum": 0, "maximum": 360}}), 263)}),
    "zone_hour_week": top("zone_hour_week", {
        "layout": S, "zones": arr(I, 263), "services": arr(S, 4), "how_count": {"const": 168},
        "mean_trips": obj({s: arr(NN, 263 * 168) for s in SERV}), "speed_mph": obj({s: arr(NN, 263 * 168) for s in SERV}),
        "speed_ratio": arr(NN, 263 * 168), "free_flow_mph": arr(NN, 263), "vref": arr(N, 263),
        "borough_free_flow_mph": obj({b: N for b in ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island"]}), "definitions": {"type": "object"}}),
    "zone_month": top("zone_month", {"layout": S, "zones": arr(I, 263), "months": arr(I, 12),
                                     "pickups": obj({s: arr(IN, 263 * 12) for s in ("yellow", "green", "fhvhv")}),
                                     "dropoffs": obj({s: arr(IN, 263 * 12) for s in ("yellow", "green", "fhvhv")})}),
    "od_top": top("od_top", {"bands": arr(obj({"id": S, "label": S, "hours": arr(I, lo=1)}), 5), "band_all_id": {"const": "all"}, "definition": S,
                             "columns": arr(S, 11), "rows": arr(arr({}, 11), lo=1)}),
    "od_matrix_totals": top("od_matrix_totals", {"columns": arr(S, 3), "note": S, "o": arr(I, lo=1), "d": arr(I, lo=1), "trips": arr({"type": "integer", "minimum": 11}, lo=1)}),
    "od_ring_top": top("od_ring_top", {"columns": arr(S, 3), "note": S, "rows": arr(arr(I, 3), 600)}),
    "network": top("network", {"method": S, "n_edges": I, "nodes": arr(obj({"zone": I, "pagerank": N, "in_strength": I, "out_strength": I, "betweenness": N, "cluster": IN}), 263)}),
    "clusters": top("clusters", {"k": {"type": "integer", "minimum": 3, "maximum": 8}, "silhouette": N, "silhouette_by_k": {"type": "object"}, "stability_ari": {"type": "object"},
                                 "random_label_silhouette": {"type": "object"}, "min_zone_trips": I, "excluded_zones": arr(I), "features": S, "label_rule": S,
                                 "clusters": arr(obj({"id": I, "label": S, "size": I, "members": arr(I, lo=1), "share_of_trips": N, "feature_ratios_vs_city": {"type": "object"}, "centroid": arr(N, 168)}), lo=3)}),
    "daily": top("daily", {"station": S, "units": {"type": "object"}, "date": arr(S, 366), "trips": obj({s: arr(I, 366) for s in ("yellow", "green", "fhvhv")}),
                           "prcp_mm": arr(NN, 366), "tmax_c": arr(NN, 366), "tmin_c": arr(NN, 366), "snow_mm": arr(NN, 366)}),
    "weather_model": top("weather_model", {"association_only": {"const": True}, "note": S, "coefficient_fields": S, "primary": S,
                                           "models": obj({m: obj({"spec": S, "se": S, "n": I, "r2": N, "adj_r2": N, "dropped_days": I,
                                                                  "coefficients": arr(obj({k: (S if k == "term" else N) for k in ("term", "beta", "se", "ci_lo", "ci_hi", "p", "pct_effect", "pct_ci_lo", "pct_ci_hi")}), lo=5)}) for m in ("bins", "continuous")}),
                                           "prcp_effect_10mm": obj({"spec": S, "pct": N, "ci_low_pct": N, "ci_high_pct": N})}),
    "bpr_fit": top("bpr_fit", {"model": S, "identifiability": S, "scenario_functions": {"type": "object"}, "free_flow_definition": S, "robustness_free_flow": {"type": "object"},
                               "boroughs": obj({b: obj({"t0_min_per_mile": N, "free_flow_mph": N, "alpha": N, "beta": N, "capacity_index": N, "capacity_units": S, "rmse": N, "r2": N, "n": I,
                                                        "x_max_observed": N, "binned_points": arr(obj({"x": N, "tti": N, "n": I}), lo=1),
                                                        "baseline": arr(obj({"how": I, "v": N, "x": N, "median_speed_mph": N, "median_trip_min": N, "tti": N, "fitted_speed_mph": N}), 168),
                                                        "zone_level": {"type": "object"}, "holdout": {"type": "object"}}) for b in ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island"]})}),
    "bpr_test_vectors": top("bpr_test_vectors", {"tolerance_rel": N, "functions": arr(S), "note": S,
                                                 "vectors": arr(obj({"case": S, "inputs": obj({k: N for k in ("obs_speed_mph", "ff_mph", "v", "c", "alpha", "beta", "demand_mult", "capacity_mult")}),
                                                                     "expected": obj({k: N for k in ("fitted_speed_mph", "scenario_speed_mph", "scenario_fitted_speed_mph")})}), lo=20)}),
    "reconciliation": top("reconciliation", {"invariant": S, "rows": arr(obj({"service": S, "month": I, "raw_rows": I, "kept": I, "exclusions": {"type": "object"}, "unknown_pu": I,
                                                                               "unknown_do": I, "unknown_od": I, "kept_known_od": I, "trip_time_mismatch_gt60s": I}), 36),
                                             "suppression": {"type": "object"}, "suppressed_cells_total": I, "suppressed_trips_total": I, "suppressed_trips_definition": S}),
    "facts": top("facts", {k: {} for k in ["trips_kept_total", "raw_rows_total", "excluded_total", "share_pct", "trips_per_minute_mean", "busiest_zone_how", "am_peak_hour", "pm_peak_hour",
                                           "weekend_peak_hour", "mn_internal_share_pct", "bk_internal_share_pct", "airport_dest_zone_count", "zones_for_half_pickups", "hinge_zone",
                                           "top_od_pair", "suppressed_cells_total", "suppressed_trips_total", "clusters", "borough_am_peak_speed_ratio", "weather_prcp_effect_10mm"]}),
    "validation": top("validation", {"bpr_holdout": {"type": "object"}, "ff_robustness": {"type": "object"}, "clustering": {"type": "object"}}),
    "meta": top("meta", {"pipeline_version": S, "generated_at": S, "sources": {"type": "object"}, "bands": arr(obj({"id": S, "label": S, "hours": arr(I, lo=1)}), 5),
                         "zones_simplify_tolerance_deg": N, "small_cell_threshold": I, "artifact_tags": {"type": "object"}, "artifact_bytes": {"type": "object"}}),
    "zones": {"$schema": "https://json-schema.org/draft/2020-12/schema", "title": "zones", **obj({
        "type": {"const": "FeatureCollection"}, "schema_version": {"const": "v1"}, "tags": TAGS,
        "features": arr(obj({"type": {"const": "Feature"}, "id": {"type": "integer", "minimum": 1, "maximum": 263},
                             "properties": obj({"id": I, "name": S, "borough": S, "cx": N, "cy": N}),
                             "geometry": obj({"type": {"enum": ["Polygon", "MultiPolygon"]}, "coordinates": {"type": "array"}})}), 263)})},
}

FILES = {"zones": "zones.geojson"}


def build() -> None:
    CONTRACTS.mkdir(parents=True, exist_ok=True)
    for n, sc in SCHEMAS.items():
        (CONTRACTS / f"{n}.schema.json").write_text(json.dumps(sc, indent=1, sort_keys=True) + "\n")


if __name__ == "__main__":
    build()
