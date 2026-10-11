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

/** meta.json: pipeline version, generation time, bands, tags per artifact. */
export interface Band { id: string; label: string; hours: number[] }
export interface Meta { pipeline_version: string; generated_at: string; bands: Band[]; [k: string]: unknown }
export const meta: ArtifactSpec<Meta> = {
  file: "meta.json",
  guard: (v): v is Meta => isObj(v) && typeof v.pipeline_version === "string" && typeof v.generated_at === "string" && Array.isArray(v.bands),
};

/** DR-8 facts.json: every headline number, computed and tested in Python. */
export interface Facts {
  trips_kept_total: number; raw_rows_total: number; excluded_total: number;
  share_pct: { fhvhv: number; yellow: number; green: number };
  trips_per_minute_mean: number;
  busiest_zone_how: { how: number; how_label: string; mean_trips: number; name: string; zone: number };
  am_peak_hour: { hour: number; label: string }; pm_peak_hour: { hour: number; label: string }; weekend_peak_hour: { hour: number; label: string };
  mn_internal_share_pct: number; bk_internal_share_pct: number; airport_dest_zone_count: number; airport_origin_zones: number[];
  zones_for_half_pickups: number;
  hinge_zone: { name: string; zone: number };
  top_od_pair: { o: number; d: number; o_name: string; d_name: string; trips: number };
  suppressed_cells_total: number; suppressed_trips_total: number;
  clusters: { k: number; silhouette: number };
}
export const facts: ArtifactSpec<Facts> = {
  file: "facts.json",
  guard: (v): v is Facts =>
    isObj(v) && isNum(v.trips_kept_total) && isNum(v.excluded_total) && isObj(v.share_pct) && isObj(v.busiest_zone_how) &&
    isObj(v.am_peak_hour) && isObj(v.pm_peak_hour) && isNum(v.mn_internal_share_pct) && isObj(v.hinge_zone) && isObj(v.top_od_pair) &&
    isNum(v.zones_for_half_pickups) && isObj(v.clusters),
};

export type Service = "all" | "yellow" | "green" | "fhvhv";
const N_ZONES = 263, HOW = 168;
/** zone_hour_week.json: columnar, index = zoneIndex * 168 + how (how = dow * 24 + hour, dow 0 = Mon). */
export interface ZoneHourWeek {
  zones: number[];
  mean_trips: Record<Service, (number | null)[]>;
  speed_mph: Record<Service, (number | null)[]>;
  speed_ratio: (number | null)[];
  free_flow_mph: (number | null)[];
}
export const zoneHourWeek: ArtifactSpec<ZoneHourWeek> = {
  file: "zone_hour_week.json",
  guard: (v): v is ZoneHourWeek =>
    isObj(v) && Array.isArray(v.zones) && v.zones.length === N_ZONES && isObj(v.mean_trips) &&
    (["all", "yellow", "green", "fhvhv"] as const).every((k) => Array.isArray((v.mean_trips as Record<string, unknown>)[k]) && ((v.mean_trips as Record<string, unknown[]>)[k]!).length === N_ZONES * HOW),
};

/** zone_month.json: index = zoneIndex * 12 + (month - 1), per service (no "all"). */
export interface ZoneMonth { zones: number[]; pickups: Record<Exclude<Service, "all">, (number | null)[]>; dropoffs: Record<Exclude<Service, "all">, (number | null)[]> }
export const zoneMonth: ArtifactSpec<ZoneMonth> = {
  file: "zone_month.json",
  guard: (v): v is ZoneMonth => isObj(v) && Array.isArray(v.zones) && isObj(v.pickups) && isObj(v.dropoffs) &&
    Array.isArray((v.pickups as Record<string, unknown>).fhvhv) && ((v.pickups as Record<string, unknown[]>).fhvhv!).length === (v.zones as unknown[]).length * 12,
};

/** od_top.json: rows [o, d, band, trips, dur_p10_min, dur_p50_min, dur_p90_min, spd_p10, spd_p50, spd_p90, dist_mi]. */
export type OdTopRow = [number, number, string, number, number | null, number | null, number | null, number | null, number | null, number | null, number | null];
export interface OdTop { bands: Band[]; band_all_id: string; columns: string[]; rows: OdTopRow[] }
export const odTop: ArtifactSpec<OdTop> = {
  file: "od_top.json",
  guard: (v): v is OdTop => isObj(v) && Array.isArray(v.bands) && Array.isArray(v.rows) && Array.isArray(v.columns) &&
    v.columns[0] === "o" && v.columns[3] === "trips" && v.columns[5] === "dur_p50_min" &&
    v.rows.every((r) => Array.isArray(r) && isNum(r[0]) && isNum(r[1]) && typeof r[2] === "string" && isNum(r[3])),
};

/** network.json: per-zone PageRank, strengths, betweenness, cluster id. */
export interface NetNode { zone: number; pagerank: number; betweenness: number; in_strength: number; out_strength: number; cluster: number | null }
export interface Network { nodes: NetNode[] }
export const network: ArtifactSpec<Network> = {
  file: "network.json",
  guard: (v): v is Network => isObj(v) && Array.isArray(v.nodes) && v.nodes.every((n) => isObj(n) && isNum(n.zone) && isNum(n.betweenness)),
};

/** clusters.json: k, silhouette, per-cluster label, 168-point profile, members. */
export interface Cluster { id: number; label: string; centroid: number[]; members: number; share_of_trips: number }
export interface Clusters { k: number; silhouette: number; excluded_zones: number[]; label_rule: string; clusters: Cluster[] }
export const clusters: ArtifactSpec<Clusters> = {
  file: "clusters.json",
  guard: (v): v is Clusters => isObj(v) && isNum(v.k) && isNum(v.silhouette) && Array.isArray(v.clusters) &&
    v.clusters.every((c) => isObj(c) && isNum(c.id) && typeof c.label === "string" && Array.isArray(c.centroid)),
  isEmpty: (v) => v.clusters.length === 0,
};

/** reconciliation.json: per service x month raw / kept / exclusions. */
export interface ReconRow { service: string; month: number; raw_rows: number; kept: number; exclusions: Record<string, number> }
export interface Reconciliation { rows: ReconRow[]; suppressed_cells_total: number; suppressed_trips_total: number }
export const reconciliation: ArtifactSpec<Reconciliation> = {
  file: "reconciliation.json",
  guard: (v): v is Reconciliation => isObj(v) && Array.isArray(v.rows) && v.rows.every((r) => isObj(r) && isNum(r.raw_rows) && isNum(r.kept) && isObj(r.exclusions)),
  isEmpty: (v) => v.rows.length === 0,
};

/** Deliberately missing artifact, used by the dev gallery to exercise the real 404 path. */
export const missingProbe: ArtifactSpec<unknown> = { file: "gallery_probe_missing.json", guard: (v): v is unknown => v !== undefined };
