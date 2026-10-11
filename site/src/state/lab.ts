/**
 * Visitor-set scenario state for S05 Pressure Lab, read by S06 (YOUR FUTURE)
 * and OBS (COMPARE). One store, pure selectors.
 */
import { emit } from "./atlas";
import { howOf } from "../data/bpr";

export const LAB_DEFAULT = { dm: 1, cm: 1, day: "weekday" as "weekday" | "weekend", hour: 8 };
export const lab = { ...LAB_DEFAULT, borough: "", touched: false };

export const labHow = () => howOf(lab.day, lab.hour);
/** YOUR FUTURE exists only once the lab differs from the observed city */
export const labChanged = () => lab.dm !== 1 || lab.cm !== 1;

export function setLab(patch: Partial<typeof lab>) {
  const touched = ("dm" in patch && patch.dm !== lab.dm) || ("cm" in patch && patch.cm !== lab.cm);
  Object.assign(lab, patch);
  if (touched) lab.touched = true;
  emit();
}
export function resetLab(defaultBorough: string) {
  Object.assign(lab, LAB_DEFAULT, { borough: defaultBorough });
  emit();
}
