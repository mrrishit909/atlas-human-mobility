import json

import jsonschema
import pytest

from pipelines.common import CONTRACTS, PUBLIC

NAMES = {p.name.replace(".schema.json", ""): p for p in CONTRACTS.glob("*.schema.json")}


def artifact_file(n):
    return "zones.geojson" if n == "zones" else f"{n}.json" if n != "zone_hour_week" else "zone_hour_week.json"


def test_all_artifacts_have_schema():
    pub = {p.name for p in PUBLIC.glob("*") if p.is_file()}
    assert pub == {artifact_file(n) for n in NAMES}


@pytest.mark.parametrize("n", sorted(NAMES))
def test_artifact_validates(n):
    schema = json.loads(NAMES[n].read_text())
    jsonschema.Draft202012Validator.check_schema(schema)
    doc = json.loads((PUBLIC / artifact_file(n)).read_text())
    jsonschema.validate(doc, schema)


def test_size_budget():
    sizes = {p.name: p.stat().st_size for p in PUBLIC.glob("*") if p.is_file()}
    assert sum(sizes.values()) < 6_000_000
    assert sizes["zones.geojson"] <= 400_000  # DR-9


def test_no_dash_characters():
    for p in PUBLIC.glob("*"):
        t = p.read_text()
        assert chr(0x2014) not in t and chr(0x2015) not in t, p.name


def test_meta_records_tolerance_and_bands(art):
    m = art("meta.json")
    assert m["zones_simplify_tolerance_deg"] > 0
    assert [b["id"] for b in m["bands"]] == ["overnight", "am_peak", "midday", "pm_peak", "evening"]
    assert art("od_top.json")["bands"] == m["bands"]
    hrs = sorted(h for b in m["bands"] for h in b["hours"])
    assert hrs == list(range(24))
