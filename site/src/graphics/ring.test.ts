import { describe, expect, it } from "vitest";
import { arcSpanDeg, chordControl, evenAngle, lerpGeom, pointAt, ringR0, ringR1, rotationToTop, viewportClass } from "./ring";
import { parseStops } from "./orb";
import { fixtureAngles, fixtureChords, FIXTURE_N } from "../lib/devFixture";

describe("viewport classes (same cutoffs as CSS)", () => {
  it("< 768 M, 768..1023 T, >= 1024 D", () => {
    expect(viewportClass(390)).toBe("M");
    expect(viewportClass(767)).toBe("M");
    expect(viewportClass(768)).toBe("T");
    expect(viewportClass(1023)).toBe("T");
    expect(viewportClass(1024)).toBe("D");
  });
});

describe("ring states (VISUAL_DESIGN 3.3)", () => {
  it("R0 reproduces the three specified viewports", () => {
    expect(ringR0(1440, 900)).toEqual({ cx: 720, cy: 450, r: 360 });
    const t = ringR0(768, 1024);
    expect([t.cx, t.cy, t.r]).toEqual([384, 430, 300]);
    const m = ringR0(390, 844);
    expect([m.cx, m.cy, m.r]).toEqual([195, 330, 160]);
  });
  it("R1 D: r 82vw = 1181, top at 50dvh, c (720, 1631), span 75.1 deg", () => {
    const g = ringR1(1440, 900);
    expect(g.r).toBeCloseTo(1180.8, 1);
    expect(g.cy - g.r).toBe(450);
    expect(g.cy).toBeCloseTo(1630.8, 1);
    expect(arcSpanDeg(1440, g.r)).toBeCloseTo(75.1, 1);
  });
  it("R1 T: r 630, top 471, c (384, 1101), span 75.1 deg", () => {
    const g = ringR1(768, 1024);
    expect(g.r).toBeCloseTo(629.8, 1);
    expect(g.cy - g.r).toBeCloseTo(471, 0);
    expect(g.cy).toBeCloseTo(1100.8, 0);
    expect(arcSpanDeg(768, g.r)).toBeCloseTo(75.1, 1);
  });
  it("R1 M: r 130vw = 507, top 439, c (195, 946), span 45.2 deg", () => {
    const g = ringR1(390, 844);
    expect(g.r).toBe(507);
    expect(g.cy - g.r).toBeCloseTo(438.9, 1);
    expect(g.cy).toBeCloseTo(945.9, 1);
    expect(arcSpanDeg(390, g.r)).toBeCloseTo(45.2, 1);
  });
  it("arc span formula is 2 asin((vw/2)/r)", () => {
    expect(arcSpanDeg(1000, 500)).toBeCloseTo(180);
    expect(arcSpanDeg(100, 10)).toBeCloseTo(180); // clamped
  });
});

describe("node geometry", () => {
  const g = { cx: 100, cy: 100, r: 50 };
  it("angles are clockwise from 12 o'clock", () => {
    const top = pointAt(g, 0), right = pointAt(g, 90), bottom = pointAt(g, 180);
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
    expect(right.x).toBeCloseTo(150); expect(right.y).toBeCloseTo(100);
    expect(bottom.y).toBeCloseTo(150);
  });
  it("evenAngle spaces n nodes over 360 deg; rotationToTop brings a node to 12 o'clock", () => {
    expect(evenAngle(0, 263)).toBe(0);
    expect(evenAngle(263, 263)).toBe(360);
    const a = evenAngle(66, 263);
    const p = pointAt(g, a + rotationToTop(a));
    expect(p.x).toBeCloseTo(100); expect(p.y).toBeCloseTo(50);
  });
  it("R0 -> R1 interpolates radius in log space, centre linearly", () => {
    const a = { cx: 0, cy: 0, r: 100 }, b = { cx: 10, cy: 20, r: 400 };
    expect(lerpGeom(a, b, 0)).toEqual(a);
    expect(lerpGeom(a, b, 1).r).toBeCloseTo(400);
    const mid = lerpGeom(a, b, 0.5);
    expect(mid.r).toBeCloseTo(200); // geometric mean
    expect(mid.cx).toBe(5); expect(mid.cy).toBe(10);
  });
  it("chord control point sits 0.35 of the way from the midpoint to the centre", () => {
    const cp = chordControl(g, { x: 50, y: 100 }, { x: 100, y: 50 });
    expect(cp.x).toBeCloseTo(75 + 0.35 * 25);
    expect(cp.y).toBeCloseTo(75 + 0.35 * 25);
  });
});

describe("dev fixture (never shipped data)", () => {
  it("is deterministic: 263 evenly spaced nodes, seeded chords", () => {
    expect(fixtureAngles.length).toBe(FIXTURE_N);
    expect(fixtureChords(10)).toEqual(fixtureChords(10));
    for (const c of fixtureChords(600)) {
      expect(c.a).toBeGreaterThanOrEqual(0); expect(c.b).toBeLessThan(FIXTURE_N); expect(c.a).not.toBe(c.b);
    }
  });
});

describe("orb stops parse the token syntax", () => {
  it("reads colours and positions, defaulting first/last to 0/1", () => {
    const s = parseStops("#fff3a6, #ffc23d 38%, #ff7a1f 66%, #ff4c25 100%");
    expect(s.map((x) => x.at)).toEqual([0, 0.38, 0.66, 1]);
    expect(s[0]!.color).toBe("#fff3a6");
  });
});
