"""Ring order for the site's radial layout (DR-1, docs/VISUAL_DESIGN.md 3.2). Deterministic.

Boroughs run clockwise from 12 o'clock: Manhattan, Bronx, Queens, Brooklyn, Staten Island, EWR, with a
1.5 degree gap after each borough. Within a borough zones are ordered by the clockwise angle from north
of the zone centroid around the borough centroid (mean of its zone centroids; longitude scaled by
cos(lat) so angles are not skewed). Each zone spans (360 - 6*1.5)/263 degrees; ring_angle_deg is the centre.
"""
from __future__ import annotations

import math

BOROUGH_ORDER = ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island", "EWR"]
GAP_DEG = 1.5


def ring_index(zones: list[dict]) -> list[dict]:
    """zones: dicts with id, name, borough, cx (lon), cy (lat). Returns index records sorted by ring_index."""
    span = (360 - len(BOROUGH_ORDER) * GAP_DEG) / len(zones)
    out: list[dict] = []
    for b, borough in enumerate(BOROUGH_ORDER):
        zs = [z for z in zones if z["borough"] == borough]
        if not zs:
            continue
        mlon = sum(z["cx"] for z in zs) / len(zs)
        mlat = sum(z["cy"] for z in zs) / len(zs)
        k = math.cos(math.radians(mlat))

        def ang(z, mlon=mlon, mlat=mlat, k=k):
            a = math.degrees(math.atan2((z["cx"] - mlon) * k, z["cy"] - mlat)) % 360.0
            return (a, z["id"])  # id breaks exact ties deterministically
        for z in sorted(zs, key=ang):
            i = len(out)
            out.append({"LocationID": z["id"], "name": z["name"], "borough": borough, "lon": z["cx"], "lat": z["cy"],
                        "ring_index": i, "ring_angle_deg": round(b * GAP_DEG + (i + 0.5) * span, 4)})
    assert len(out) == len(zones)
    return out
