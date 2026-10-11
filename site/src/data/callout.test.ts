import { describe, expect, it } from "vitest";
import { ASYM_MIN_MARGIN, asymmetryCallout } from "./copy";

describe("S06 asymmetry callout (QA D-011)", () => {
  it("states its scope and the hour it was computed for", () => {
    expect(asymmetryCallout(1.6, -1.1, "WED 08:00")).toBe("Citywide at WED 08:00, adding 15% costs more than removing 15% saves.");
  });
  it("is hidden when the margin is too thin to headline (the real WED 08:00 case: +1.164 vs -1.126)", () => {
    expect(asymmetryCallout(1.164, -1.126, "WED 08:00")).toBeNull();
    expect(asymmetryCallout(1 + ASYM_MIN_MARGIN - 0.01, -1, "X")).toBeNull();
  });
  it("never claims the reverse", () => {
    expect(asymmetryCallout(1.0, -1.03, "X")).toBeNull();
  });
});
