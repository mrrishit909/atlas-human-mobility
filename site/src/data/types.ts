/**
 * Artifact types (DATA_CONTRACTS.md + VISUAL_DESIGN 6.2 data requests), with
 * hand-written guards at the trust boundary. Shapes for DR-* artifacts are
 * checked against the published files in types.test.ts; the guards are the
 * single place to reconcile.
 */
import type { ArtifactSpec } from "./loader";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** zones.geojson: FeatureCollection of TLC zones (LocationID properties). */
export interface ZonesGeo { type: "FeatureCollection"; features: { properties: Record<string, unknown>; geometry: unknown }[] }
export const zonesGeo: ArtifactSpec<ZonesGeo> = {
  file: "zones.geojson",
  guard: (v): v is ZonesGeo => isObj(v) && Array.isArray(v.features) && v.features.every((f) => isObj(f) && isObj(f.properties)),
  isEmpty: (v) => v.features.length === 0,
};

/** DR-1 zones_index.json (as published by the pipeline, schema v1). */
export interface ZoneIndexRow { LocationID: number; name: string; borough: string; lon: number; lat: number; ring_index: number; ring_angle_deg: number }
export interface ZonesIndex { schema_version: string; borough_order: string[]; gap_deg: number; zones: ZoneIndexRow[] }
export const zonesIndex: ArtifactSpec<ZonesIndex> = {
  file: "zones_index.json",
  guard: (v): v is ZonesIndex =>
    isObj(v) && Array.isArray(v.zones) && isNum(v.gap_deg) &&
    v.zones.every((z) => isObj(z) && isNum(z.LocationID) && typeof z.name === "string" && isNum(z.ring_index) && isNum(z.ring_angle_deg)),
  isEmpty: (v) => v.zones.length === 0,
};

/** DR-11 od_ring_top.json: columnar rows [o, d, trips], descending by trips. */
export interface OdRingTop { schema_version: string; columns: ["o", "d", "trips"]; rows: [number, number, number][] }
export const odRingTop: ArtifactSpec<OdRingTop> = {
  file: "od_ring_top.json",
  guard: (v): v is OdRingTop =>
    isObj(v) && Array.isArray(v.columns) && v.columns.join() === "o,d,trips" &&
    Array.isArray(v.rows) && v.rows.every((r) => Array.isArray(r) && r.length === 3 && r.every(isNum)),
  isEmpty: (v) => v.rows.length === 0,
};

/** meta.json: pipeline version, generation time, tags per artifact. */
export interface Meta { pipeline_version: string; generated_at: string; [k: string]: unknown }
export const meta: ArtifactSpec<Meta> = {
  file: "meta.json",
  guard: (v): v is Meta => isObj(v) && typeof v.pipeline_version === "string" && typeof v.generated_at === "string",
};

/** Deliberately missing artifact, used by the dev gallery to exercise the real 404 path. */
export const missingProbe: ArtifactSpec<unknown> = { file: "gallery_probe_missing.json", guard: (v): v is unknown => v !== undefined };
