/**
 * OBS cross-filter store (VISUAL_DESIGN OBS): one store; map, inspector,
 * readout strip and scrubber all derive from it through pure selectors.
 */
import { emit } from "./atlas";
import type { Service } from "../data/types";

export type ObsLayer = "demand" | "speed" | "clusters" | "network";
export type Region = { kind: "borough"; name: string } | { kind: "zone"; loc: number } | null;
export const OBS_DEFAULT = {
  how: 2 * 24 + 8, // WED 08:00
  service: "all" as Service,
  layer: "demand" as ObsLayer,
  region: null as Region,
  selectedZone: null as number | null,
  view3D: true,
  flows: true,
  compare: "observed" as "observed" | "future",
  scale: "city" as "city" | "borough" | "zone",
};
export const obs = { ...OBS_DEFAULT, playing: false, explore: false };

export function setObs(patch: Partial<typeof obs>) {
  Object.assign(obs, patch);
  emit();
}
export function resetObs() {
  Object.assign(obs, OBS_DEFAULT, { playing: false });
  emit();
}

/** zone membership in the current region (LocationID) */
export function inRegion(loc: number, borough: string, region: Region) {
  if (!region) return true;
  return region.kind === "borough" ? borough === region.name : region.loc === loc;
}

/**
 * Readout: the sum of the rendered zone values for the same filter. Inputs are
 * the per-zone mean trips at (how, service) in zone order plus borough names;
 * the borough sums add to the citywide total (tested).
 */
export function regionTotal(values: ArrayLike<number>, locs: ArrayLike<number>, boroughs: ArrayLike<string>, region: Region) {
  let s = 0;
  for (let i = 0; i < values.length; i++) if (inRegion(locs[i]!, boroughs[i]!, region)) s += values[i]!;
  return s;
}
