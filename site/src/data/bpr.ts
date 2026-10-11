/**
 * BPR volume-delay scenario model, ported 1:1 from analytics/bpr.py
 * (parity vectors in bpr_test_vectors.json, relative tolerance 1e-9).
 * TTI(x) = 1 + alpha * x^beta, x = v / C. Anchored: at dm = cm = 1 the
 * scenario speed is exactly the observed speed (no "simulated" drift).
 */
export interface BoroughFit {
  alpha: number; beta: number; capacity_index: number; free_flow_mph: number; x_max_observed: number;
  rmse: number; r2: number; n: number;
  binned_points: { x: number; tti: number; n: number }[];
  baseline: { how: number; v: number; x: number; median_speed_mph: number | null; median_trip_min: number | null; tti: number | null; fitted_speed_mph: number }[];
  holdout?: { borough_level?: { test: { rmse: number; r2_vs_const: number; rmse_freeflow_const: number; rmse_const_train_mean: number; skill_vs_freeflow: number } } };
}

export const tti = (x: number, alpha: number, beta: number) => 1 + alpha * Math.pow(Math.max(0, x), beta);

export function scenarioSpeed(obs: number, v: number, C: number, alpha: number, beta: number, dm: number, cm: number) {
  if (dm === 1 && cm === 1) return obs; // anchored: exact, not obs * A / A (which can drift by 1 ulp)
  return (obs * (1 + alpha * Math.pow(v / C, beta))) / (1 + alpha * Math.pow((v * dm) / (C * cm), beta));
}
export function scenarioFittedSpeed(ff: number, v: number, C: number, alpha: number, beta: number, dm: number, cm: number) {
  return ff / (1 + alpha * Math.pow((v * dm) / (C * cm), beta));
}

export interface LabResult {
  obsSpeed: number; simSpeed: number; obsMin: number; simMin: number;
  x0: number; x1: number; tti0: number; tti1: number; extrapolated: boolean; changed: boolean;
}

/** One borough x hour-of-week under demand multiplier dm and capacity multiplier cm (1 + dc). */
export function labResult(fit: BoroughFit, how: number, dm: number, cm: number): LabResult | null {
  const b = fit.baseline[how];
  if (!b || b.median_speed_mph === null || b.median_trip_min === null) return null;
  const C = fit.capacity_index;
  const simSpeed = scenarioSpeed(b.median_speed_mph, b.v, C, fit.alpha, fit.beta, dm, cm);
  const x0 = b.v / C, x1 = (b.v * dm) / (C * cm);
  const tti0 = tti(x0, fit.alpha, fit.beta), tti1 = tti(x1, fit.alpha, fit.beta);
  return {
    obsSpeed: b.median_speed_mph, simSpeed,
    obsMin: b.median_trip_min, simMin: dm === 1 && cm === 1 ? b.median_trip_min : (b.median_trip_min * tti1) / tti0,
    x0, x1, tti0, tti1, extrapolated: x1 > fit.x_max_observed, changed: dm !== 1 || cm !== 1,
  };
}

/** Representative hour-of-week for the lab's day type: Wednesday for weekdays, Saturday for weekends. */
export const howOf = (day: "weekday" | "weekend", hour: number) => (day === "weekday" ? 2 : 5) * 24 + hour;
export const howLabel = (how: number) => `${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][Math.floor(how / 24)]} ${String(how % 24).padStart(2, "0")}:00`;
