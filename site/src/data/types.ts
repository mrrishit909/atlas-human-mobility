/**
 * Artifact types (DATA_CONTRACTS.md + VISUAL_DESIGN 6.2 data requests), with
 * hand-written guards at the trust boundary. Shapes for DR-* artifacts are
 * PROVISIONAL until the data agent publishes them; the guards are the single
 * place to reconcile.
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

/** DR-1 zones_index.json (provisional). */
export interface ZoneIndexRow { id: number; name: string; borough: string; lon: number; lat: number; ring_index: number; ring_angle_deg: number }
export interface ZonesIndex { zones: ZoneIndexRow[] }
export const zonesIndex: ArtifactSpec<ZonesIndex> = {
  file: "zones_index.json",
  guard: (v): v is ZonesIndex =>
    isObj(v) && Array.isArray(v.zones) &&
    v.zones.every((z) => isObj(z) && isNum(z.id) && typeof z.name === "string" && isNum(z.ring_index) && isNum(z.ring_angle_deg)),
  isEmpty: (v) => v.zones.length === 0,
};

/** DR-11 od_ring_top.json (provisional): top OD pairs by annual trips, descending. */
export interface OdPair { o: number; d: number; trips: number }
export interface OdRingTop { pairs: OdPair[] }
export const odRingTop: ArtifactSpec<OdRingTop> = {
  file: "od_ring_top.json",
  guard: (v): v is OdRingTop => isObj(v) && Array.isArray(v.pairs) && v.pairs.every((p) => isObj(p) && isNum(p.o) && isNum(p.d) && isNum(p.trips)),
  isEmpty: (v) => v.pairs.length === 0,
};

/** meta.json: pipeline version, generation time, tags per artifact. */
export interface Meta { pipeline_version: string; generated_at: string; [k: string]: unknown }
export const meta: ArtifactSpec<Meta> = {
  file: "meta.json",
  guard: (v): v is Meta => isObj(v) && typeof v.pipeline_version === "string" && typeof v.generated_at === "string",
};

/** Deliberately missing artifact, used by the dev gallery to exercise the real 404 path. */
export const missingProbe: ArtifactSpec<unknown> = { file: "gallery_probe_missing.json", guard: (v): v is unknown => v !== undefined };
