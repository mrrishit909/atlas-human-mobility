"""P01-QA-004: check on-screen numbers (probe3 numbersText) against site/public/data/facts.json.
Usage: python3 facts_check.py <probe-results.json> <facts.json>"""
import json, sys

res = json.load(open(sys.argv[1]))
f = json.load(open(sys.argv[2]))
text = {k: v.upper() for k, v in res["numbersText"].items()}
allt = "\n".join(text.values())
b = f["borough_am_peak_speed_ratio"]
checks = [
    ("busiest zone mean trips", f"{round(f['busiest_zone_how']['mean_trips']):,}"),
    ("busiest zone name", f["busiest_zone_how"]["name"].upper()),
    ("busiest how label", f["busiest_zone_how"]["how_label"].upper()),
    ("trips per minute", f"{round(f['trips_per_minute_mean']):,}"),
    ("trips kept total", f"{f['trips_kept_total']:,}"),
    ("raw rows total", f"{f['raw_rows_total']:,}"),
    ("excluded total", f"{f['excluded_total']:,}"),
    ("share fhvhv", f"{f['share_pct']['fhvhv']:.1f}%"),
    ("share yellow", f"{f['share_pct']['yellow']:.1f}%"),
    ("share green", f"{f['share_pct']['green']:.1f}%"),
    ("top od pair trips", f"{f['top_od_pair']['trips']:,}"),
    ("top od origin", f["top_od_pair"]["o_name"].upper()),
    ("zones for half pickups", f"{f['zones_for_half_pickups']} "),
    ("Manhattan AM speed ratio", f"{round(b['Manhattan']['speed_ratio_pct'])}%"),
    ("Manhattan free flow", f"{b['Manhattan']['free_flow_mph']:.1f} MPH"),
    ("MN internal share", f"{round(f['mn_internal_share_pct'])}%"),
    ("rain effect", f"{f['weather_prcp_effect_10mm']['pct']:.1f}%"),
    ("rain CI low", f"{f['weather_prcp_effect_10mm']['ci_low_pct']:.1f}"),
    ("rain CI high", f"{f['weather_prcp_effect_10mm']['ci_high_pct']:.1f}"),
    ("silhouette", f"{f['clusters']['silhouette']:.2f}"),
    ("k", f"K={f['clusters']['k']}"),
    ("am peak", f["am_peak_hour"]["label"].upper()),
    ("pm peak", f["pm_peak_hour"]["label"].upper()),
]
ok = 0
for name, s in checks:
    where = [k for k, v in text.items() if s in v]
    ok += bool(where)
    print(f"{'OK ' if where else 'MISS'} {name}: '{s.strip()}' -> {where[:3]}")
print(f"{ok}/{len(checks)} found on screen")
