import { describe, expect, it } from "vitest";
import { futureLine } from "./copy";

describe("S06 data line (QA D-043)", () => {
  const rows = [{ borough: "Queens", delta: 2.04 }, { borough: "Bronx", delta: 1.3 }, { borough: "Staten Island", delta: 0.6 }];
  it("names the boroughs moved most and least, in minutes, at the hour computed", () => {
    expect(futureLine(rows, "WED 08:00")).toBe("At WED 08:00: Queens +2.0 min a trip, the most; Staten Island +0.6, the least.");
  });
  it("ranks by size, so a quieter future reads as savings", () => {
    expect(futureLine(rows.map((r) => ({ ...r, delta: -r.delta })), "X")).toBe("At X: Queens -2.0 min a trip, the most; Staten Island -0.6, the least.");
  });
  it("is absent without data", () => expect(futureLine([], "X")).toBeNull());
});
