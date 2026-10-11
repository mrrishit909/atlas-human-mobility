"""Zone dimension: TLC shapefile (EPSG:2263) -> simplified WGS84 GeoJSON, one feature per LocationID.

The shapefile has repeated LocationIDs (multi-part zones stored as separate records); these are
dissolved with shapely.unary_union. Join key LocationID stays exact. Coordinates: 5 decimals (~1 m).
"""
from __future__ import annotations

import io
import warnings
import zipfile
from collections import defaultdict

import shapefile
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

warnings.filterwarnings("ignore", category=DeprecationWarning)

from pipelines.common import PUBLIC, RAW, SCHEMA_VERSION, write_json

SIMPLIFY_DEG = 0.00008  # ~9 m at NYC latitude
_T = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)


def to_wgs84(x: float, y: float) -> tuple[float, float]:
    """EPSG:2263 (NY Long Island, US survey feet) -> (lon, lat). Tested against known zone centroids."""
    return _T.transform(x, y)


def load_zones() -> tuple[list[dict], dict]:
    z = zipfile.ZipFile(RAW / "zones" / "taxi_zones.zip")
    rd = lambda ext: io.BytesIO(z.read(f"taxi_zones/taxi_zones.{ext}"))
    r = shapefile.Reader(shp=rd("shp"), shx=rd("shx"), dbf=rd("dbf"))
    geoms: dict[int, list] = defaultdict(list)
    attrs: dict[int, dict] = {}
    for sr in r.shapeRecords():
        rec = sr.record.as_dict()
        lid = int(rec["LocationID"])
        geoms[lid].append(transform(to_wgs84, shape(sr.shape.__geo_interface__)))
        attrs[lid] = {"name": rec["zone"], "borough": rec["borough"]}
    dup = {k: len(v) for k, v in geoms.items() if len(v) > 1}
    feats = []
    for lid in sorted(geoms):
        if not 1 <= lid <= 263:
            continue
        g = unary_union(geoms[lid])
        c = g.centroid
        gs = g.simplify(SIMPLIFY_DEG, preserve_topology=True)
        if gs.is_empty:
            gs = g
        feats.append({"type": "Feature", "id": lid,
                      "properties": {"id": lid, "name": attrs[lid]["name"], "borough": attrs[lid]["borough"],
                                     "cx": round(c.x, 5), "cy": round(c.y, 5)},
                      "geometry": mapping(gs)})
    return feats, {"duplicate_location_ids": dup, "n_records": len(r), "n_zones": len(feats)}


def _round(o):
    if isinstance(o, (list, tuple)):
        return [_round(x) for x in o]
    return round(o, 5) if isinstance(o, float) else o


def build() -> dict:
    feats, info = load_zones()
    for f in feats:
        f["geometry"] = {"type": f["geometry"]["type"], "coordinates": _round(f["geometry"]["coordinates"])}
    fc = {"type": "FeatureCollection", "schema_version": SCHEMA_VERSION,
          "tags": {"geometry": "OBSERVED", "centroid": "DERIVED"}, "features": feats}
    size = write_json(PUBLIC / "zones.geojson", fc)
    info["bytes"] = size
    return info


if __name__ == "__main__":
    print(build())
