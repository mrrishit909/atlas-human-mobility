import type { MapStyle } from "./deckMap";
import { annual, clusterOf, getZhw, halfPickups, model, zhwIndex } from "../state/atlas";
import { lerp } from "../lib/math";
import type { Service } from "../data/types";

type RGB = [number, number, number];
const DEEP: RGB = [12, 26, 43], BLUE: RGB = [88, 184, 225], WHITE: RGB = [236, 248, 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(lerp(a[k]!, b[k]!, t))) as RGB;
export const EDGE: [number, number, number, number] = [0, 0, 0, 200];
export const CLUSTER_RGB: RGB[] = [[255, 255, 255], [88, 184, 225], [143, 162, 255]];
export const CLUSTER_CSS = ["#ffffff", "#58b8e1", "#8fa2ff"];

/**
 * Quantile height ramp: deep blue-black -> #58B8E1 -> near-white for the top
 * decile, so concentration reads before the CONCENTRATION step. Rank-based,
 * so a few giant zones don't flatten everyone else into one colour.
 */
export function quantileRamp(values: ArrayLike<number>) {
  const idx = Array.from({ length: values.length }, (_, i) => i).sort((a, b) => Math.abs(values[a]!) - Math.abs(values[b]!));
  const t = new Float32Array(values.length);
  idx.forEach((i, r) => (t[i] = values.length > 1 ? r / (values.length - 1) : 1));
  return (i: number): RGB => {
    const q = t[i] ?? 0;
    if (Math.abs(values[i] ?? 0) <= 0) return DEEP;
    return q < 0.9 ? mix(DEEP, BLUE, q / 0.9) : mix(BLUE, WHITE, (q - 0.9) / 0.1);
  };
}

/** 5-step sequential speed-ratio scale: white = free-flowing to light blue = slowest (DERIVED). */
export function speedStep(ratio: number | null): RGB | null {
  if (ratio === null || !isFinite(ratio)) return null;
  const steps: RGB[] = [[255, 255, 255], [205, 233, 245], [160, 213, 236], [120, 196, 230], [88, 184, 225]];
  const k = ratio >= 0.9 ? 0 : ratio >= 0.75 ? 1 : ratio >= 0.6 ? 2 : ratio >= 0.45 ? 3 : 4;
  return steps[k]!;
}
export const SPEED_STEPS = ["≥ 90%", "75-90%", "60-75%", "45-60%", "< 45%"];

export type Metric = "pickups" | "dropoffs" | "net";
export function metricValues(metric: Metric) {
  const pu = annual("pickups"), dr = annual("dropoffs");
  if (!pu || !dr) return null;
  if (metric === "pickups") return pu;
  if (metric === "dropoffs") return dr;
  return Float64Array.from(pu, (v, i) => v - dr[i]!);
}

/** S04 style (phases: 0 map, 1 concentration, 2 clusters). Heights unchanged: annual metric. */
export function demandStyle(phase: number, metric: Metric, polygonOpacity: number, elevationScale: number): MapStyle | null {
  const m = model(), vals = metricValues(metric), half = halfPickups(), cl = clusterOf();
  if (!m || !vals || !half) return null;
  let max = 0;
  for (const v of vals) max = Math.max(max, Math.abs(v));
  const ramp = quantileRamp(vals);
  const ri = (loc: number) => m.idx.get(loc) ?? -1;
  return {
    key: `d:${phase}:${metric}`, max, edge: EDGE, polygonOpacity, elevationScale,
    value: (loc) => vals[ri(loc)] ?? 0,
    fill: (loc) => {
      const i = ri(loc);
      if (phase >= 2 && cl) {
        const c = cl[i] ?? -1;
        return c >= 0 ? [...CLUSTER_RGB[c % 3]!, 235] : [41, 41, 41, 200];
      }
      const v = vals[i] ?? 0;
      if (metric === "net" && v < 0) return [22, 22, 22, 70]; // net sink: dimmed (legend says so)
      return [...ramp(i), phase >= 1 && !half.has(i) ? 64 : 255];
    },
  };
}

/** Per-zone values at an hour-of-week (OBS / S05), keyed by LocationID. */
export function hourValues(how: number, service: Service) {
  const z = getZhw(), idx = zhwIndex();
  if (!z || !idx) return null;
  const src = z.mean_trips[service];
  return (loc: number) => { const zi = idx.get(loc); return zi === undefined ? 0 : src[zi * 168 + how] ?? 0; };
}
export function speedRatioAt(how: number) {
  const z = getZhw(), idx = zhwIndex();
  if (!z || !idx) return null;
  return (loc: number) => { const zi = idx.get(loc); return zi === undefined ? null : z.speed_ratio[zi * 168 + how] ?? null; };
}
