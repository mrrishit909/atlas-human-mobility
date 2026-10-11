/**
 * Pure selectors over the published artifacts. No business logic beyond
 * re-indexing and summing: every headline number comes from facts.json.
 */
import type { Chord } from "../graphics/ring";
import type { Facts, OdTop, OdTopRow, Reconciliation, Service, ZoneHourWeek, ZoneMonth, ZonesIndex, Network } from "./types";

export interface RingModel {
  n: number;
  /** LocationID at ring index i */
  ids: number[];
  /** ring index for a LocationID */
  idx: Map<number, number>;
  angles: Float32Array;
  borough: string[];
  name: string[];
  lon: Float32Array;
  lat: Float32Array;
  arcs: Record<string, { start: number; end: number; mid: number }>;
}

export function ringModel(zi: ZonesIndex): RingModel {
  const rows = [...zi.zones].sort((a, b) => a.ring_index - b.ring_index);
  const arcs: RingModel["arcs"] = {};
  for (const r of rows) {
    const a = arcs[r.borough] ?? { start: r.ring_angle_deg, end: r.ring_angle_deg, mid: 0 };
    a.start = Math.min(a.start, r.ring_angle_deg);
    a.end = Math.max(a.end, r.ring_angle_deg);
    arcs[r.borough] = a;
  }
  for (const a of Object.values(arcs)) a.mid = (a.start + a.end) / 2;
  return {
    n: rows.length,
    ids: rows.map((r) => r.LocationID),
    idx: new Map(rows.map((r) => [r.LocationID, r.ring_index])),
    angles: Float32Array.from(rows, (r) => r.ring_angle_deg),
    borough: rows.map((r) => r.borough),
    name: rows.map((r) => r.name),
    lon: Float32Array.from(rows, (r) => r.lon),
    lat: Float32Array.from(rows, (r) => r.lat),
    arcs,
  };
}

/** OD pairs -> ring chords; weight = log trips normalised over the set (alpha/width encode it). */
export function toChords(pairs: [number, number, number][], m: RingModel): (Chord & { trips: number; o: number; d: number })[] {
  if (!pairs.length) return [];
  const logs = pairs.map((p) => Math.log(p[2]));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  const out: (Chord & { trips: number; o: number; d: number })[] = [];
  pairs.forEach(([o, d, t], i) => {
    const a = m.idx.get(o), b = m.idx.get(d);
    if (a === undefined || b === undefined) return;
    out.push({ a, b, w: hi > lo ? (logs[i]! - lo) / (hi - lo) : 1, trips: t, o, d });
  });
  return out;
}

export type DayType = "weekday" | "weekend";
const DAYS: Record<DayType, number[]> = { weekday: [0, 1, 2, 3, 4], weekend: [5, 6] };

/**
 * Mean trips per zone at each hour of the chosen day type, in RING order:
 * out[ringIndex * 24 + hour]. Suppressed cells (null, 1..10 annual trips) count as 0.
 */
export function hourlyByRing(zhw: ZoneHourWeek, m: RingModel, service: Service, day: DayType): Float32Array {
  const out = new Float32Array(m.n * 24);
  const src = zhw.mean_trips[service];
  const days = DAYS[day];
  zhw.zones.forEach((loc, zi) => {
    const ri = m.idx.get(loc);
    if (ri === undefined) return;
    for (let h = 0; h < 24; h++) {
      let s = 0;
      for (const d of days) s += src[zi * 168 + d * 24 + h] ?? 0;
      out[ri * 24 + h] = s / days.length;
    }
  });
  return out;
}

/** Citywide total per hour: the readout equals the sum of the node values (tested). */
export function hourTotals(byRing: Float32Array, n: number): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += byRing[i * 24 + h]!;
    return s;
  });
}

/** CHECK for the S03a statement: AM and PM peaks are local maxima inside 05-11 and 15-21. */
export function peaksHold(totals: number[], am: number, pm: number) {
  const isLocalMax = (h: number) => totals[h]! >= totals[h - 1]! && totals[h]! >= totals[h + 1]!;
  const argmax = (a: number, b: number) => { let best = a; for (let h = a; h <= b; h++) if (totals[h]! > totals[best]!) best = h; return best; };
  return argmax(5, 11) === am && argmax(15, 21) === pm && isLocalMax(am) && isLocalMax(pm);
}

export function hourBandOf<B extends { id: string; hours: number[] }>(hour: number, bands: B[]): B {
  return bands.find((b) => b.hours.includes(hour)) ?? bands[0]!;
}

/** Top-n rows of od_top in a band. */
export function bandRows(od: OdTop, band: string, n = 300): OdTopRow[] {
  return od.rows.filter((r) => r[2] === band).sort((a, b) => b[3] - a[3]).slice(0, n);
}

export type AnchorKey = "MN" | "AIR" | "BK" | "HINGE";
export interface Anchor { key: AnchorKey; angle: number; origins: Set<number>; both: boolean; color: string; outline: boolean }

export function anchors(m: RingModel, f: Facts): Anchor[] {
  const ang = (loc: number) => m.angles[m.idx.get(loc)!]!;
  const airports = f.airport_origin_zones;
  const air = airports.map(ang);
  const set = (b: string) => new Set(m.ids.filter((_, i) => m.borough[i] === b));
  return [
    { key: "MN", angle: m.arcs.Manhattan!.mid, origins: set("Manhattan"), both: false, color: "#58B8E1", outline: false },
    { key: "AIR", angle: circularMid(air), origins: new Set(airports), both: false, color: "#192CE4", outline: true },
    { key: "BK", angle: m.arcs.Brooklyn!.mid, origins: set("Brooklyn"), both: false, color: "#690DE2", outline: true },
    { key: "HINGE", angle: ang(f.hinge_zone.zone), origins: new Set([f.hinge_zone.zone]), both: true, color: "#FFFFFF", outline: false },
  ];
}

/** Mean of angles on the circle (degrees). */
export function circularMid(angles: number[]) {
  const x = angles.reduce((s, a) => s + Math.cos((a * Math.PI) / 180), 0);
  const y = angles.reduce((s, a) => s + Math.sin((a * Math.PI) / 180), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The anchor's chord fan: top k corridors from its origins (and into it, for the hinge). */
export function fanRows(od: OdTop, band: string, origins: Set<number>, both: boolean, k = 40): OdTopRow[] {
  return od.rows
    .filter((r) => r[2] === band && (origins.has(r[0]) || (both && origins.has(r[1]))))
    .sort((a, b) => b[3] - a[3])
    .slice(0, k);
}

/** Cleaning ledger totals from reconciliation rows. */
export function ledger(r: Reconciliation) {
  const byService: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  let raw = 0, kept = 0;
  for (const row of r.rows) {
    raw += row.raw_rows;
    kept += row.kept;
    byService[row.service] = (byService[row.service] ?? 0) + row.kept;
    for (const [k, v] of Object.entries(row.exclusions)) reasons[k] = (reasons[k] ?? 0) + v;
  }
  const excluded = Object.values(reasons).reduce((a, b) => a + b, 0);
  return { raw, kept, excluded, byService, reasons, balances: raw === kept + excluded };
}

/** Annual pickups / dropoffs per ring index (all services, all months). */
export function annualByRing(zm: ZoneMonth, m: RingModel, field: "pickups" | "dropoffs"): Float64Array {
  const out = new Float64Array(m.n);
  const src = zm[field];
  zm.zones.forEach((loc, zi) => {
    const ri = m.idx.get(loc);
    if (ri === undefined) return;
    let s = 0;
    for (const svc of ["yellow", "green", "fhvhv"] as const) for (let mo = 0; mo < 12; mo++) s += src[svc][zi * 12 + mo] ?? 0;
    out[ri] = s;
  });
  return out;
}

/** Smallest set of zones holding half of all pickups (ring indices). */
export function halfSet(pickups: Float64Array): Set<number> {
  const order = Array.from(pickups.keys()).sort((a, b) => pickups[b]! - pickups[a]!);
  const total = pickups.reduce((a, b) => a + b, 0);
  const s = new Set<number>();
  let acc = 0;
  for (const i of order) {
    if (acc >= total / 2) break;
    s.add(i);
    acc += pickups[i]!;
  }
  return s;
}

export const clusterByRing = (net: Network, m: RingModel) => {
  const out = new Int8Array(m.n).fill(-1);
  for (const node of net.nodes) {
    const ri = m.idx.get(node.zone);
    if (ri !== undefined && node.cluster !== null) out[ri] = node.cluster;
  }
  return out;
};
