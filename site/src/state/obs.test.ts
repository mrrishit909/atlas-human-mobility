import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { regionTotal } from "./obs";
import { ringModel } from "../data/derive";
import type { ZoneHourWeek, ZonesIndex } from "../data/types";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
const m = ringModel(read<ZonesIndex>("zones_index.json"));
const z = read<ZoneHourWeek>("zone_hour_week.json");
const idx = new Map(z.zones.map((loc, i) => [loc, i]));

describe("OBS cross-filter: the readout reconciles", () => {
  for (const [how, svc] of [[56, "all"], [56, "green"], [145, "fhvhv"]] as const) {
    it(`borough totals add to the citywide total (how ${how}, ${svc})`, () => {
      const vals = m.ids.map((loc) => z.mean_trips[svc][idx.get(loc)! * 168 + how] ?? 0);
      const city = regionTotal(vals, m.ids, m.borough, null);
      const sum = [...new Set(m.borough)].reduce((s, b) => s + regionTotal(vals, m.ids, m.borough, { kind: "borough", name: b }), 0);
      expect(sum).toBeCloseTo(city, 6);
      const q = regionTotal(vals, m.ids, m.borough, { kind: "borough", name: "Queens" });
      const direct = m.ids.reduce((s, _loc, i) => s + (m.borough[i] === "Queens" ? vals[i]! : 0), 0);
      expect(q).toBeCloseTo(direct, 9);
      const one = regionTotal(vals, m.ids, m.borough, { kind: "zone", loc: 138 });
      expect(one).toBe(vals[m.ids.indexOf(138)]);
    });
  }
});
