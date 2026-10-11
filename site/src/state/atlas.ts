/**
 * Shared scene state for the ring scenes (S00-S04): data models derived once
 * from the loaded artifacts, plus the visitor-set parameters. Mutable on
 * purpose: the ring director reads it every frame; React reads it through
 * useAtlas() which re-renders only on emit().
 */
import { useSyncExternalStore } from "react";
import { getStore } from "../data/loader";
import { anchors, annualByRing, clusterByRing, halfSet, hourlyByRing, ringModel, toChords, type Anchor, type DayType, type RingModel } from "../data/derive";
import { clusters, facts, meta, network, odRingTop, odTop, reconciliation, zoneHourWeek, zoneMonth, zonesGeo, zonesIndex, type Service } from "../data/types";
import { Tween } from "../motion/tween";
import { easeSmooth } from "../motion/ease";

const listeners = new Set<() => void>();
let version = 0;
export const emit = () => {
  version++;
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") window.dispatchEvent(new Event("atlas:redraw"));
};
export const useAtlas = () => useSyncExternalStore((l) => { listeners.add(l); return () => void listeners.delete(l); }, () => version);

const ready = <T,>(spec: Parameters<typeof getStore<T>>[0]): T | null => {
  const s = getStore(spec).state;
  return s.status === "ready" ? s.data : null;
};

// ---- cached derivations (recomputed only when the source object changes) ----
function memo<A extends object, R>(fn: (a: A) => R) {
  let key: A | null = null, val: R;
  return (a: A) => (a === key ? val! : ((key = a), (val = fn(a))));
}
const modelOf = memo(ringModel);
export const model = (): RingModel | null => { const z = ready(zonesIndex); return z ? modelOf(z) : null; };
export const getFacts = () => ready(facts);
export const getMeta = () => ready(meta);
export const getOdTop = () => ready(odTop);
export const getRecon = () => ready(reconciliation);
export const getGeo = () => ready(zonesGeo);
export const getClusters = () => ready(clusters);

const orbitOf = memo((o: { rows: [number, number, number][] }) => o.rows);
export function orbitChords(n = 600) {
  const m = model(), o = ready(odRingTop);
  if (!m || !o) return null;
  return toChordsCached(m, orbitOf(o).slice(0, n));
}
const chordCache = new Map<string, ReturnType<typeof toChords>>();
function toChordsCached(m: RingModel, pairs: [number, number, number][]) {
  const key = `${pairs.length}:${pairs[0]?.join()}:${pairs.at(-1)?.join()}`;
  let c = chordCache.get(key);
  if (!c) chordCache.set(key, (c = toChords(pairs, m)));
  return c;
}
export const pairChords = (pairs: [number, number, number][]) => { const m = model(); return m ? toChordsCached(m, pairs) : []; };

const hourlyCache = new Map<string, Float32Array>();
export function hourly(service: Service, day: DayType) {
  const m = model(), z = ready(zoneHourWeek);
  if (!m || !z) return null;
  const k = `${service}:${day}`;
  let v = hourlyCache.get(k);
  if (!v) hourlyCache.set(k, (v = hourlyByRing(z, m, service, day)));
  return v;
}

let anchorsCache: Anchor[] | null = null;
export function getAnchors() {
  const m = model(), f = getFacts();
  if (!m || !f) return null;
  return (anchorsCache ??= anchors(m, f));
}

const annualCache: Record<string, Float64Array> = {};
export function annual(field: "pickups" | "dropoffs") {
  const m = model(), zm = ready(zoneMonth);
  if (!m || !zm) return null;
  return (annualCache[field] ??= annualByRing(zm, m, field));
}
let half: Set<number> | null = null;
export const halfPickups = () => { const a = annual("pickups"); return a ? (half ??= halfSet(a)) : null; };
let clusterIdx: Int8Array | null = null;
export const clusterOf = () => { const m = model(), n = ready(network); return m && n ? (clusterIdx ??= clusterByRing(n, m)) : null; };

// ---- visitor-set parameters + stepped-transition clocks ----
export const rush = {
  day: "weekday" as DayType,
  service: "all" as Service,
  /** previous dataset for the 600ms keyed size tween */
  prev: null as Float32Array | null,
  changedAt: -1e9,
  band: "",
  bandPrev: "",
  bandAt: -1e9,
  lastHour: -1,
  waveAt: -1e9,
};

export const dial = {
  state: 0,
  /** authored index, or a visitor-chosen zone (ring index) when overridden */
  overridden: false,
  zone: -1,
  anchor: -1,
  band: "all",
  prevKey: "",
  stepAt: -1e9,
  bandAt: -1e9,
  rot: new Tween(0, 1200, easeSmooth, true),
  rotInit: false,
  hover: -1,
};

export const demand = { metric: "pickups" as "pickups" | "dropoffs" | "net", phase: 0, phaseAt: -1e9 };

/** Start loading: critical set now; scene data at idle (MOTION_SYSTEM 10 budgets). */
export function bootData() {
  for (const s of [zonesIndex, odRingTop, facts, meta]) getStore(s as never).prefetch();
  const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 600));
  idle(() => { for (const s of [reconciliation, odTop, zoneHourWeek]) getStore(s as never).prefetch(); });
  for (const s of [zonesIndex, odRingTop, facts, meta, reconciliation, odTop, zoneHourWeek, zoneMonth, network, clusters, zonesGeo]) getStore(s as never).subscribe(emit);
}
/** S03 entry: lazy S04 data (geometry, months, clusters). */
export function loadDemandData() {
  for (const s of [zonesGeo, zoneMonth, network, clusters]) getStore(s as never).prefetch();
}
