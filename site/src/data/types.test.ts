import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusters, facts, meta, network, odRingTop, odTop, reconciliation, zoneHourWeek, zoneMonth, zonesGeo, zonesIndex } from "./types";
import type { ArtifactSpec } from "./loader";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));

describe("guards accept the artifacts the pipeline actually published", () => {
  for (const spec of [zonesGeo, zonesIndex, odRingTop, meta, facts, zoneHourWeek, zoneMonth, odTop, network, clusters, reconciliation] as ArtifactSpec<unknown>[]) {
    it(spec.file, () => expect(spec.guard(read(spec.file))).toBe(true));
  }
  it("rejects a wrong shape (SCHEMA MISMATCH path)", () => {
    expect(zonesIndex.guard({ zones: [{ id: 1 }] })).toBe(false);
    expect(odRingTop.guard({ pairs: [] })).toBe(false);
  });
  it("zones_index has 263 zones with unique ring indices", () => {
    const z = read("zones_index.json");
    expect(z.zones).toHaveLength(263);
    expect(new Set(z.zones.map((r: { ring_index: number }) => r.ring_index)).size).toBe(263);
  });
});
