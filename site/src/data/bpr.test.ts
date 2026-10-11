import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { labResult, scenarioFittedSpeed, scenarioSpeed, type BoroughFit } from "./bpr";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
interface Vec { case: string; inputs: { obs_speed_mph: number; ff_mph: number; v: number; c: number; alpha: number; beta: number; demand_mult: number; capacity_mult: number }; expected: { scenario_speed_mph: number; scenario_fitted_speed_mph: number; fitted_speed_mph: number } }
const tv = read<{ tolerance_rel: number; vectors: Vec[] }>("bpr_test_vectors.json");
const fit = read<{ boroughs: Record<string, BoroughFit> }>("bpr_fit.json");
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

describe("BPR parity with analytics/bpr.py (bpr_test_vectors.json)", () => {
  it(`matches all ${tv.vectors.length} Python vectors within ${tv.tolerance_rel} relative`, () => {
    expect(tv.vectors.length).toBeGreaterThan(100);
    for (const v of tv.vectors) {
      const i = v.inputs;
      expect(rel(scenarioSpeed(i.obs_speed_mph, i.v, i.c, i.alpha, i.beta, i.demand_mult, i.capacity_mult), v.expected.scenario_speed_mph), v.case).toBeLessThanOrEqual(tv.tolerance_rel);
      expect(rel(scenarioFittedSpeed(i.ff_mph, i.v, i.c, i.alpha, i.beta, i.demand_mult, i.capacity_mult), v.expected.scenario_fitted_speed_mph), v.case).toBeLessThanOrEqual(tv.tolerance_rel);
      expect(rel(scenarioFittedSpeed(i.ff_mph, i.v, i.c, i.alpha, i.beta, 1, 1), v.expected.fitted_speed_mph), v.case).toBeLessThanOrEqual(tv.tolerance_rel);
    }
  });
  it("reproduces the observed values exactly at 1.0x demand and 0% capacity change (hard rule 5)", () => {
    for (const f of Object.values(fit.boroughs)) for (let how = 0; how < 168; how++) {
      const r = labResult(f, how, 1, 1);
      if (!r) continue;
      expect(r.simSpeed).toBe(r.obsSpeed);
      expect(r.simMin).toBe(r.obsMin);
      expect(r.changed).toBe(false);
    }
  });
  it("is monotonic: more demand slows, more capacity speeds up", () => {
    const f = fit.boroughs.Manhattan!;
    let last = Infinity;
    for (let dm = 0.5; dm <= 1.5001; dm += 0.05) { const s = labResult(f, 56, dm, 1)!.simSpeed; expect(s).toBeLessThanOrEqual(last); last = s; }
    last = 0;
    for (let cm = 0.7; cm <= 1.2001; cm += 0.05) { const s = labResult(f, 56, 1, cm)!.simSpeed; expect(s).toBeGreaterThanOrEqual(last); last = s; }
  });
});
