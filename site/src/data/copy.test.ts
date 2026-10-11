import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copyS01, copyS02, copyS03a, copyS03b, copyS04, int, pct0, pct1 } from "./copy";
import { anchors, annualByRing, halfSet, hourTotals, hourlyByRing, ledger, ringModel } from "./derive";
import type { Facts, Meta, Reconciliation, ZoneHourWeek, ZoneMonth, ZonesIndex } from "./types";
import { STATEMENT } from "../scenes/S01City";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
const facts = read<Facts>("facts.json");
const meta = read<Meta>("meta.json");
const zi = read<ZonesIndex>("zones_index.json");
const m = ringModel(zi);

/** Every number printed in a string, as written (commas kept). */
const numbers = (s: string) => (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,$/, ""));

describe("copy deck numbers are facts.json values (VISUAL_DESIGN section 6)", () => {
  const allowed = new Set<string>([
    int(facts.busiest_zone_how.mean_trips), String(facts.busiest_zone_how.zone), int(facts.trips_per_minute_mean), int(facts.trips_kept_total),
    pct1(facts.share_pct.fhvhv), pct1(facts.share_pct.yellow), pct1(facts.share_pct.green), int(facts.excluded_total), int(facts.suppressed_cells_total),
    pct0(facts.mn_internal_share_pct), pct0(facts.bk_internal_share_pct), int(facts.airport_dest_zone_count), String(facts.zones_for_half_pickups),
    String(facts.clusters.k), facts.clusters.silhouette.toFixed(2), String(zi.zones.length), meta.pipeline_version,
    // literal rule thresholds and calendar labels written in the design copy, not data values
    "1", "11", "80", "2024", "01", "02", "03", "04", "3", "1.9", "8", "6", "10",
  ]);
  const texts = [
    ...Object.values(copyS01(facts)),
    ...copyS02(facts, meta).flatMap((c) => [c.title, c.body]),
    ...Object.values(copyS03a(facts, true)).filter((v): v is string => typeof v === "string"),
    ...Object.values(copyS03b(facts).states).flatMap((s) => [s.title, s.body ?? ""]),
    ...Object.values(copyS04(facts)),
    STATEMENT,
  ];
  it("contains no number that is not bound to a named field", () => {
    for (const t of texts) for (const n of numbers(t)) expect(allowed, `"${n}" in "${t}"`).toContain(n);
  });
  it("renders the headline values exactly", () => {
    expect(copyS01(facts).card1Body).toContain(int(facts.busiest_zone_how.mean_trips));
    expect(copyS01(facts).card2Body).toContain(int(facts.trips_kept_total));
    expect(copyS02(facts, meta)[2]!.title).toBe(`${int(facts.excluded_total)} rows didn't make it.`);
    expect(copyS04(facts).s2).toContain(`${facts.zones_for_half_pickups} of 263`);
    expect(STATEMENT).toContain(String(zi.zones.length));
  });
  it("(CHECK) claims follow their checks", () => {
    expect(copyS03b({ ...facts, mn_internal_share_pct: 40 }).states.MN.title).toBe("Manhattan's corridors");
    expect(copyS03a(facts, false).statement).toBe("The city keeps two rush hours.");
  });
});

describe("site-side derivations agree with the pipeline's facts", () => {
  it("cleaning ledger sums equal facts and balance (RAW = KEPT + EXCLUDED)", () => {
    const l = ledger(read<Reconciliation>("reconciliation.json"));
    expect(l.raw).toBe(facts.raw_rows_total);
    expect(l.kept).toBe(facts.trips_kept_total);
    expect(l.excluded).toBe(facts.excluded_total);
    expect(l.balances).toBe(true);
  });
  it("half of all pickups come from facts.zones_for_half_pickups zones", () => {
    expect(halfSet(annualByRing(read<ZoneMonth>("zone_month.json"), m, "pickups")).size).toBe(facts.zones_for_half_pickups);
  });
  it("the S03a statement's peak CHECK holds on the weekday curve, and the readout equals the node sum", () => {
    const z = read<ZoneHourWeek>("zone_hour_week.json");
    const by = hourlyByRing(z, m, "all", "weekday");
    const tot = hourTotals(by, m.n);
    let s = 0;
    for (let i = 0; i < m.n; i++) s += by[i * 24 + 8]!;
    expect(tot[8]).toBeCloseTo(s, 6);
    const am = facts.am_peak_hour.hour, pm = facts.pm_peak_hour.hour;
    expect(tot[am]!).toBeGreaterThan(tot[am - 1]!);
    expect(tot[pm]!).toBeGreaterThan(tot[pm + 1]!);
  });
  it("dial anchors: Manhattan centred on its arc, the hinge is facts.hinge_zone", () => {
    const as = anchors(m, facts);
    expect(as.map((a) => a.key)).toEqual(["MN", "AIR", "BK", "HINGE"]);
    expect([...as[3]!.origins]).toEqual([facts.hinge_zone.zone]);
    expect(as[0]!.angle).toBeGreaterThan(m.arcs.Manhattan!.start);
    expect(as[0]!.angle).toBeLessThan(m.arcs.Manhattan!.end);
    expect(m.n).toBe(263);
  });
});
