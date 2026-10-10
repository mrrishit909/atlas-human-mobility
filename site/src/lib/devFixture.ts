/**
 * DEV FIXTURE. NOT DATA. Deterministic stand-in geometry for the dev gallery
 * only: 263 evenly spaced nodes and seeded pseudo-random chords. Never imported
 * by a shipped scene; real scenes read zones_index.json / od_ring_top.json.
 */
import { evenAngle, type Chord } from "../graphics/ring";

export const FIXTURE_LABEL = "DEV FIXTURE · NOT DATA";
export const FIXTURE_N = 263;
export const fixtureAngles = Float32Array.from({ length: FIXTURE_N }, (_, i) => evenAngle(i, FIXTURE_N));

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

/** n chords with a heavy-tailed weight and a bias toward short (local) chords. */
export function fixtureChords(n: number, seed = 7): Chord[] {
  const rnd = lcg(seed);
  const out: Chord[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rnd() * FIXTURE_N);
    const span = Math.floor((rnd() ** 2.2) * (FIXTURE_N / 2)) + 2;
    const b = (a + (rnd() < 0.5 ? span : FIXTURE_N - span)) % FIXTURE_N;
    out.push({ a, b, w: Math.pow(1 - i / n, 3) });
  }
  return out;
}

/** Fan of k chords from one anchor node. */
export function fixtureFan(anchor: number, k = 40, seed = 11): Chord[] {
  const rnd = lcg(seed + anchor);
  return Array.from({ length: k }, (_, i) => {
    const span = Math.floor((rnd() ** 1.6) * (FIXTURE_N / 2)) + 3;
    return { a: anchor, b: (anchor + (rnd() < 0.5 ? span : FIXTURE_N - span)) % FIXTURE_N, w: Math.pow(1 - i / k, 2) };
  });
}
