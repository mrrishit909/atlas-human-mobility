import { describe, expect, it } from "vitest";
import { packRow } from "./S03bCorridors";

const ok = (row: { x: number; w: number }[], W: number) => {
  for (let i = 0; i < row.length; i++) {
    expect(row[i]!.x).toBeGreaterThanOrEqual(16 - 0.5);
    expect(row[i]!.x + row[i]!.w).toBeLessThanOrEqual(W - 16 + 0.5);
    if (i) expect(row[i]!.x).toBeGreaterThanOrEqual(row[i - 1]!.x + row[i - 1]!.w + 8 - 0.5);
  }
};

describe("destination tickets pack without overlap (QA D-003)", () => {
  it("keeps 8px gaps and 16px margins, pushing in from the right edge", () => {
    const row = packRow([{ x: 900, w: 300, trips: 5 }, { x: 980, w: 260, trips: 4 }, { x: 1010, w: 200, trips: 3 }], 1024);
    ok(row, 1024);
    expect(row.length).toBe(3);
  });
  it("drops the smallest corridor when the row cannot hold them all", () => {
    const row = packRow([{ x: 200, w: 400, trips: 9 }, { x: 500, w: 400, trips: 1 }, { x: 800, w: 400, trips: 5 }], 1024);
    ok(row, 1024);
    expect(row.map((t) => t.trips)).not.toContain(1);
  });
});
