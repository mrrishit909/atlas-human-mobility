/**
 * Ring director: the ring is ONE object that carries over S00 -> S04, so it
 * lives on one fixed canvas and its state is a function of (scene, progress,
 * time). Consecutive scenes agree at their seams (scene A at p = 1 equals
 * scene B at p = 0). Scrubbed parts are pure; stepped parts use tweens/clocks
 * from state/atlas.ts.
 */
import { WebMercatorViewport } from "@math.gl/web-mercator";
import {
  chordControl, drawPulse, lerpGeom, pointAt, quadLength, ringR0, ringR0c, ringR1, scaleGeom, viewportClass,
  type Chord, type RingDrawOpts, type RingGeom, type ViewportClass,
} from "../graphics/ring";
import { clamp, lerp } from "../lib/math";
import { easePremium, easeSmooth, easeSymmetric } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { motionEnabled } from "../state/motion";
import { bandRows, fanRows, hourBandOf, type Anchor, type RingModel } from "../data/derive";
import type { OdTopRow } from "../data/types";
import {
  annual, dial, emit, getAnchors, getFacts, getMeta, getOdTop, hourly, model, orbitChords, pairChords, rush,
} from "../state/atlas";
import { mapView, projectCentroids } from "./mapView";

export const RING_SCENES = ["city", "anatomy", "rush-hour", "corridors", "demand"] as const;
export type RingScene = (typeof RING_SCENES)[number];
export const DIAL_THRESHOLDS = [0.25, 0.5, 0.75] as const;
export const INTRO_MS = 4600;

export interface Frame {
  opts: Omit<RingDrawOpts, "width" | "height">;
  /** extra canvas drawing after the ring (pulses, hover, waves) */
  extra?: (ctx: CanvasRenderingContext2D) => void;
  /** true while something time-based is moving (forces redraw) */
  live: boolean;
  canvasOpacity: number;
}

const nodeBase = (cls: ViewportClass) => (cls === "D" ? 4 : cls === "T" ? 3 : 2);
const nodeHorizon = (cls: ViewportClass) => (cls === "M" ? 5 : 6);
const r0e = (w: number, h: number, cls: ViewportClass) => scaleGeom(ringR0(w, h, cls), 1.15);

// ---------------------------------------------------------------- S00 intro
export const intro = { playing: false, start: 0, completeFrom: -1, completeAt: 0 };
/** Intro clock in ms (0..4600). SKIP/Esc/scroll compress the remainder into 350ms. */
export function introTime(now: number) {
  if (!intro.playing) return INTRO_MS;
  if (!intro.start) intro.start = now;
  const t = now - intro.start;
  if (intro.completeFrom < 0) return Math.min(INTRO_MS, t);
  const k = easePremium(clamp((now - intro.completeAt) / 350));
  return intro.completeFrom + (INTRO_MS - intro.completeFrom) * k;
}

const geoCache = { key: "", xs: new Float32Array(0), ys: new Float32Array(0), cx: 0, cy: 0 };
function geoPositions(m: RingModel, w: number, h: number, cls: ViewportClass) {
  const key = `${w}x${h}:${orbitChords()?.length ?? 0}`;
  if (geoCache.key !== key) {
    let a = 180, b = -180, c = 90, d = -90;
    // fit what is actually lit at 900-1900ms (the zones the top-600 corridors touch), not the whole
    // city: untouched outer zones appear later and fly in from beyond the frame (fix 3)
    const lit = new Set<number>();
    for (const ch of orbitChords() ?? []) { lit.add(ch.a); lit.add(ch.b); }
    for (let i = 0; i < m.n; i++) {
      if (lit.size && !lit.has(i) && cls !== "M") continue;
      a = Math.min(a, m.lon[i]!); b = Math.max(b, m.lon[i]!); c = Math.min(c, m.lat[i]!); d = Math.max(d, m.lat[i]!);
    }
    // D/T: the city spans about 60% of the viewport height before it gathers into R0
    const pad = cls === "M" ? { left: 24, right: 24, top: 90, bottom: 260 } : { left: w * 0.05, right: w * 0.05, top: h * 0.1, bottom: h * 0.12 };
    const vp = new WebMercatorViewport({ width: w, height: h }).fitBounds([[a, c], [b, d]], { padding: pad });
    const xs = new Float32Array(m.n), ys = new Float32Array(m.n);
    for (let i = 0; i < m.n; i++) { const [x, y] = vp.project([m.lon[i]!, m.lat[i]!]); xs[i] = x!; ys[i] = y!; }
    const [cx, cy] = vp.project([(a + b) / 2, (c + d) / 2]);
    Object.assign(geoCache, { key, xs, ys, cx, cy });
  }
  return geoCache;
}

/** Seeded pick of the ~80 ignition chords that carry one pulse. */
const PULSE_SET = (() => { let s = 99; const set = new Set<number>(); while (set.size < 80) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; set.add(1 + (s % 599)); } return set; })();

function introFrame(t: number, w: number, h: number, cls: ViewportClass): Frame | null {
  const m = model();
  if (!m) return null;
  const chords = orbitChords() ?? [];
  const geo = geoPositions(m, w, h, cls);
  const pull = 1 - 0.45 * easeSymmetric(clamp((t - 2200) / 600));
  const grow = easeSmooth(clamp((t - 3300) / 1200));
  const ring = scaleGeom(ringR0(w, h, cls), 1 + 0.15 * grow);
  const xs = new Float32Array(m.n), ys = new Float32Array(m.n);
  const appear = new Float32Array(m.n).fill(2500);
  const starts = chords.map((_, i) => (i === 0 ? 500 : 1100 + 1200 * Math.pow(i / 599, 0.6)));
  chords.forEach((c, i) => { appear[c.a] = Math.min(appear[c.a]!, i === 0 ? 300 : starts[i]!); appear[c.b] = Math.min(appear[c.b]!, i === 0 ? 300 : starts[i]!); });
  const alphas = new Float32Array(m.n);
  for (let i = 0; i < m.n; i++) {
    const gx = geo.cx + (geo.xs[i]! - geo.cx) * pull, gy = geo.cy + (geo.ys[i]! - geo.cy) * pull;
    const rp = pointAt(ring, m.angles[i]!);
    const e = easePremium(clamp((t - 2500 - (200 * i) / (m.n - 1)) / 800));
    xs[i] = lerp(gx, rp.x, e);
    ys[i] = lerp(gy, rp.y, e);
    alphas[i] = easePremium(clamp((t - appear[i]!) / 200));
  }
  const travel = easePremium(clamp((t - 2600) / 900));
  const drawn: Chord[] = chords.map((c, i) => ({
    ...c,
    alpha: i === 0 ? 1 : easePremium(clamp((t - starts[i]!) / 350)),
    draw: i === 0 ? easePremium(clamp((t - 500) / 600)) : 1,
  }));
  const bend = 0.35 * travel;
  const speed = cls === "M" ? 0.4 : 0.6; // px per ms
  const on = motionEnabled();
  return {
    canvasOpacity: 1,
    live: t < INTRO_MS,
    opts: {
      geom: ring, rotation: 0, angles: m.angles, xy: { xs, ys }, bend,
      strokeAlpha: 0.9 * clamp((t - 3000) / 500), nodeSize: nodeBase(cls), nodeAlpha: 0.7, nodeAlphas: alphas,
      chords: drawn, chordAlpha: 1, opacity: 1 - 0.7 * grow,
    },
    extra: on ? (ctx) => {
      ctx.globalAlpha = 1 - 0.7 * grow;
      chords.forEach((c, i) => {
        if (i !== 0 && !PULSE_SET.has(i)) return;
        const p1 = { x: xs[c.a]!, y: ys[c.a]! }, p2 = { x: xs[c.b]!, y: ys[c.b]! };
        const cp = chordControl(ring, p1, p2, bend);
        const len = quadLength(p1, cp, p2);
        const tp = i === 0 ? easePremium(clamp((t - 500) / 600)) : ((t - starts[i]!) * speed) / Math.max(1, len);
        drawPulse(ctx, p1, cp, p2, tp, len);
      });
      ctx.globalAlpha = 1;
    } : undefined,
  };
}

// ---------------------------------------------------------------- S01
function cityFrame(p: number, w: number, h: number, cls: ViewportClass): Frame | null {
  const m = model();
  if (!m) return null;
  const s = easeSymmetric(windowed(p, 0, 0.4));
  return {
    canvasOpacity: 1, live: false,
    opts: {
      geom: lerpGeom(r0e(w, h, cls), ringR1(w, h, cls), s), rotation: 0, angles: m.angles,
      nodeSize: lerp(nodeBase(cls), nodeHorizon(cls), s), nodeAlpha: 0.7 + 0.2 * s,
      chords: orbitChords() ?? undefined, chordAlpha: (1 - s) ** 2, opacity: 0.3 + 0.6 * s,
    },
  };
}

// ---------------------------------------------------------------- S03a helpers
function rushSizes(cls: ViewportClass, hour: number, now: number, m: RingModel) {
  const cur = hourly(rush.service, rush.day);
  if (!cur) return null;
  const k = cls === "D" ? 1 : cls === "T" ? 0.8 : 0.5;
  const sizeSet = (data: Float32Array) => {
    let max = 0;
    for (let i = 0; i < data.length; i++) max = Math.max(max, data[i]!);
    const h0 = Math.floor(hour), h1 = Math.min(23, h0 + 1), f = hour - h0;
    const out = new Float32Array(m.n), hollow = new Uint8Array(m.n);
    for (let i = 0; i < m.n; i++) {
      const v = lerp(data[i * 24 + h0]!, data[i * 24 + h1]!, f);
      out[i] = max > 0 ? (2 + 10 * Math.sqrt(v / max)) * k : 2 * k;
      hollow[i] = v <= 0 ? 1 : 0;
    }
    return { out, hollow };
  };
  const a = sizeSet(cur);
  const e = motionEnabled() ? easeSmooth(clamp((now - rush.changedAt) / 600)) : 1;
  if (rush.prev && e < 1) {
    const b = sizeSet(rush.prev);
    for (let i = 0; i < m.n; i++) a.out[i] = lerp(b.out[i]!, a.out[i]!, e);
  }
  return { sizes: a.out, hollow: a.hollow, live: e < 1 };
}

function rushChords(hour: number, now: number) {
  const od = getOdTop(), meta = getMeta();
  if (!od || !meta) return { chords: [] as Chord[], live: false };
  const band = hourBandOf(Math.floor(hour), od.bands).id;
  if (band !== rush.band) {
    rush.bandPrev = rush.band;
    rush.band = band;
    rush.bandAt = motionEnabled() ? now : -1e9;
  }
  const toPairs = (b: string) => bandRows(od, b, 300).map((r) => [r[0], r[1], r[3]] as [number, number, number]);
  const cur = pairChords(toPairs(band));
  const since = now - rush.bandAt;
  if (!rush.bandPrev || since > 600) return { chords: cur, live: false };
  // keyed re-band: outgoing fade 200ms, incoming fade-in 350ms, shared chords hold
  const prev = pairChords(toPairs(rush.bandPrev));
  const key = (c: { o: number; d: number }) => `${c.o}-${c.d}`;
  const curKeys = new Set(cur.map(key)), prevKeys = new Set(prev.map(key));
  const out: Chord[] = [];
  for (const c of prev) if (!curKeys.has(key(c))) out.push({ ...c, alpha: 1 - clamp(since / 200) });
  for (const c of cur) out.push(prevKeys.has(key(c)) ? c : { ...c, alpha: easePremium(clamp((since - 100) / 350)) });
  return { chords: out, live: true };
}

export const hourAt = (p: number) => clamp((p - 0.1) / 0.8) * 23.99;

// ---------------------------------------------------------------- S02
function anatomyFrame(p: number, w: number, h: number, cls: ViewportClass, now: number): Frame | null {
  const m = model();
  if (!m) return null;
  const r1 = ringR1(w, h, cls);
  if (p < 0.85) {
    return { canvasOpacity: 1, live: false, opts: { geom: r1, rotation: 0, angles: m.angles, nodeSize: nodeHorizon(cls), nodeAlpha: 0.9, opacity: lerp(0.9, 0.2, windowed(p, 0, 0.1)) } };
  }
  // final 15%: the camera pulls back from the dim horizon to the rush orbit
  const s = easeSymmetric(windowed(p, 0.85, 1));
  const sz = rushSizes(cls, 0, now, m);
  const sizes = sz ? Float32Array.from(sz.sizes, (v) => lerp(nodeHorizon(cls), v, s)) : undefined;
  const ch = rushChords(0, now);
  return {
    canvasOpacity: 1, live: ch.live,
    opts: {
      geom: lerpGeom(r1, ringR0c(w, h, cls), s), rotation: 0, angles: m.angles, sizes, nodeAlpha: 0.9,
      chords: ch.chords, chordAlpha: s, opacity: lerp(0.2, 1, s),
    },
  };
}

// ---------------------------------------------------------------- S03a
function rushFrame(p: number, w: number, h: number, cls: ViewportClass, now: number): Frame | null {
  const m = model();
  if (!m) return null;
  const hour = hourAt(p);
  const fl = Math.floor(hour);
  const f = getFacts();
  if (fl !== rush.lastHour) {
    if (f && rush.lastHour >= 0 && (fl === f.am_peak_hour.hour || fl === f.pm_peak_hour.hour) && now - rush.waveAt > 1000 && motionEnabled()) rush.waveAt = now;
    rush.lastHour = fl;
  }
  const zoom = easeSymmetric(windowed(p, 0.9, 1));
  const geom = lerpGeom(ringR0c(w, h, cls), ringR1(w, h, cls), zoom);
  const mn = getAnchors()?.[0];
  const rotation = mn ? -mn.angle * zoom : 0;
  const sz = rushSizes(cls, hour, now, m);
  const sizes = sz ? Float32Array.from(sz.sizes, (v) => lerp(v, nodeHorizon(cls), zoom)) : undefined;
  const ch = rushChords(hour, now);
  const waveT = (now - rush.waveAt) / 600;
  return {
    canvasOpacity: 1, live: !!sz?.live || ch.live || waveT < 1,
    opts: {
      geom, rotation, angles: m.angles, sizes, hollow: zoom < 0.5 ? sz?.hollow : undefined, nodeAlpha: 0.9,
      chords: ch.chords, chordAlpha: 1 - zoom, opacity: 1,
    },
    extra: waveT < 1 ? (ctx) => {
      // peak pulse wave: a 40-degree orange arc travelling clockwise once (motion only, no value)
      const start = -Math.PI / 2 + waveT * Math.PI * 2;
      const a0 = start - (40 * Math.PI) / 180;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        const aa = a0 + ((start - a0) * i) / 12;
        ctx.strokeStyle = `rgba(255,76,37,${(0.7 * (i + 1)) / 12})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(geom.cx, geom.cy, geom.r, aa, aa + (start - a0) / 12);
        ctx.stroke();
      }
      ctx.restore();
    } : undefined,
  };
}

// ---------------------------------------------------------------- S03b
export interface DialAnchor { key: string; angle: number; origins: Set<number>; both: boolean; zone?: number }

export function currentAnchor(): DialAnchor | null {
  const as = getAnchors(), m = model();
  if (!as || !m) return null;
  if (dial.overridden && dial.zone >= 0) {
    const loc = m.ids[dial.zone]!;
    return { key: `Z${loc}`, angle: m.angles[dial.zone]!, origins: new Set([loc]), both: false, zone: dial.zone };
  }
  return as[dial.overridden && dial.anchor >= 0 ? dial.anchor : dial.state]!;
}

export function fanFor(a: DialAnchor | Anchor, band = dial.band): OdTopRow[] {
  const od = getOdTop();
  return od ? fanRows(od, band, a.origins, a.both, 40) : [];
}

/**
 * Set the dial anchor; the choreography restarts from current values.
 * Scroll thresholds call it with the stepped state (clearing any override);
 * a node click passes `zone`, arrow keys / tabs pass `anchor` (visitor override,
 * held until the next threshold crossing).
 */
export function setDial(state: number, opts: { zone?: number; anchor?: number; instant?: boolean } = {}) {
  const now = performance.now();
  const prev = currentAnchor();
  dial.prevKey = prev?.key ?? "";
  dial.state = state;
  if (opts.zone !== undefined) { dial.overridden = true; dial.zone = opts.zone; dial.anchor = -1; }
  else if (opts.anchor !== undefined) { dial.overridden = true; dial.zone = -1; dial.anchor = opts.anchor; }
  else { dial.overridden = false; dial.zone = -1; dial.anchor = -1; }
  if (currentAnchor()?.key === dial.prevKey && !opts.instant) { emit(); return; }
  const a = currentAnchor();
  if (!a) return;
  const instant = opts.instant || !motionEnabled();
  dial.rot.retarget(-a.angle, now, instant ? 0 : 1200);
  dial.stepAt = instant ? -1e9 : now;
  emit();
}

const CHORD_STAGGER = 15;
function corridorsFrame(p: number, w: number, h: number, cls: ViewportClass, now: number, jumped: boolean): Frame | null {
  const m = model(), as = getAnchors();
  if (!m || !as) return null;
  if (!dial.rotInit) { dial.rot.value = -as[0]!.angle; dial.rot.retarget(-as[0]!.angle, now, 0); dial.rotInit = true; }
  const next = stepState(dial.state, p, DIAL_THRESHOLDS);
  // a direct jump resolves the stepped state without animation (6.2 step 3)
  if (next !== dial.state || (jumped && !dial.overridden)) setDial(next, { instant: jumped });
  const moving = dial.rot.update(now);
  const a = currentAnchor()!;
  const geom = ringR1(w, h, cls);
  const since = now - dial.stepAt;
  const sinceBand = now - dial.bandAt;
  const on = motionEnabled();
  const rows = fanFor(a);
  const fan = pairChords(rows.map((r) => [r[0], r[1], r[3]] as [number, number, number]));
  // draw-in from the anchor end: origin index is `a` for outbound; flip inbound hinge chords
  const fanDrawn: Chord[] = fan.map((c, i) => {
    const out = a.origins.has(c.o);
    const base = out ? c : { ...c, a: c.b, b: c.a };
    const start = Math.min(since - 600, sinceBand) - CHORD_STAGGER * i;
    return { ...base, draw: on ? easePremium(clamp(start / 800)) : 1 };
  });
  let chords: Chord[] = fanDrawn;
  if (on && since < 200 && dial.prevKey) {
    const prevA = dial.prevKey.startsWith("Z")
      ? { origins: new Set([Number(dial.prevKey.slice(1))]), both: false }
      : as.find((x) => x.key === dial.prevKey);
    if (prevA) {
      const old = pairChords(fanFor(prevA as Anchor).map((r) => [r[0], r[1], r[3]] as [number, number, number]));
      chords = [...old.map((c) => ({ ...c, alpha: 1 - since / 200 })), ...fanDrawn.map((c) => ({ ...c, draw: 0 }))];
    }
  }
  const arrived = !on || since > 1080;
  const tick = on ? easePremium(clamp((since - 1080) / 350)) : 1;
  const markers = as.map((x) => ({ angle: x.angle, color: x.color, outline: x.outline }));
  if (a.zone !== undefined) markers.push({ angle: a.angle, color: "#FFFFFF", outline: false });
  const drawnAll = fanDrawn.every((c) => (c.draw ?? 1) >= 1);
  const maxPulses = cls === "M" ? 40 : 120;
  const speed = cls === "M" ? 0.4 : 0.6;
  return {
    canvasOpacity: 1,
    live: moving || since < 2400 || sinceBand < 1600 || (on && drawnAll),
    opts: {
      geom, rotation: dial.rot.value, angles: m.angles, nodeSize: nodeHorizon(cls), nodeAlpha: 0.9,
      chords, chordAlpha: 1, opacity: 1, markers,
      anchor: { tick: cls === "M" ? 72 : 120, tickProgress: arrived ? tick : 0 },
    },
    extra: (ctx) => {
      const pos = (i: number) => pointAt(geom, m.angles[i]! + dial.rot.value);
      // hovered chord: white, 2px
      if (dial.hover >= 0 && fanDrawn[dial.hover]) {
        const c = fanDrawn[dial.hover]!;
        const p1 = pos(c.a), p2 = pos(c.b), cp = chordControl(geom, p1, p2);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y); ctx.stroke();
      }
      if (!on || !drawnAll || moving) return;
      // pulses: deterministic per chord (seeded phase), rate by trips; DERIVED label in the DOM
      let budget = maxPulses;
      fanDrawn.forEach((c, i) => {
        if (budget <= 0) return;
        const p1 = pos(c.a), p2 = pos(c.b), cp = chordControl(geom, p1, p2);
        const len = quadLength(p1, cp, p2);
        const k = Math.max(1, Math.round(1 + 3 * c.w));
        for (let j = 0; j < k && budget > 0; j++, budget--) {
          const phase = ((i * 0.618 + j / k) % 1);
          const tp = (((now - dial.stepAt) * speed) / len + phase) % 1.6;
          drawPulse(ctx, p1, cp, p2, tp, len);
        }
      });
    },
  };
}

export function setHover(i: number) {
  if (i === dial.hover) return;
  dial.hover = i;
  dispatchEvent(new Event("atlas:redraw"));
}
/** Hour band chips re-key the fan and ledger only (no rotation). */
export function setBand(b: string) {
  dial.band = b;
  dial.bandAt = motionEnabled() ? performance.now() : -1e9;
  emit();
}

/** Screen geometry of the current fan (tickets, hover hit-testing, tests). */
export function fanGeometry(w: number, h: number) {
  const m = model(), a = currentAnchor();
  if (!m || !a) return [];
  const geom = ringR1(w, h, viewportClass(w));
  const rot = dial.rot.target;
  const rows = fanFor(a);
  return rows.map((r) => {
    const out = a.origins.has(r[0]);
    const from = m.idx.get(out ? r[0] : r[1])!, to = m.idx.get(out ? r[1] : r[0])!;
    const p1 = pointAt(geom, m.angles[from]! + rot), p2 = pointAt(geom, m.angles[to]! + rot);
    return { row: r, p1, p2, cp: chordControl(geom, p1, p2), destVisible: p2.x >= 0 && p2.x <= w && p2.y >= 0 && p2.y <= h };
  });
}

// ---------------------------------------------------------------- S04
/** Canvas2D -> deck.gl crossfade state at S04 p = 0.65 (hysteresis 0.02, 200ms, time-based). */
export const handoff = { on: false, at: -1e9, deckReady: false };

const MORPH_A = 0.3, MORPH_B = 0.65;
export const HANDOFF = 0.65;

let projCache = { key: "", xs: new Float32Array(0), ys: new Float32Array(0) };
export function morphTargets(w: number, h: number) {
  const m = model();
  if (!m) return null;
  const key = `${w}x${h}`;
  if (projCache.key !== key) projCache = { key, ...projectCentroids(m, mapView(m, w, h, viewportClass(w)), w, h) };
  return projCache;
}

const BOROUGH_ORDER = ["Manhattan", "Bronx", "Queens", "Brooklyn", "Staten Island", "EWR"];
let rankCache: Float32Array | null = null;
/** Per-node morph window start s_k (MOTION_SYSTEM 5.7). */
function morphStarts(m: RingModel) {
  if (rankCache) return rankCache;
  const out = new Float32Array(m.n);
  const counts: Record<string, number> = {}, seen: Record<string, number> = {};
  m.borough.forEach((b) => (counts[b] = (counts[b] ?? 0) + 1));
  for (let i = 0; i < m.n; i++) {
    const b = m.borough[i]!;
    const r = (seen[b] = (seen[b] ?? -1) + 1);
    out[i] = MORPH_A + 0.12 * (Math.max(0, BOROUGH_ORDER.indexOf(b)) / 5) + 0.03 * (r / counts[b]!);
  }
  return (rankCache = out);
}

/** Node screen positions at S04 progress p (also used by the 1px parity test). */
export function morphPositions(p: number, w: number, h: number, rotation: number) {
  const m = model(), tgt = morphTargets(w, h);
  if (!m || !tgt) return null;
  const ring = ringR0(w, h, viewportClass(w));
  const starts = morphStarts(m);
  const xs = new Float32Array(m.n), ys = new Float32Array(m.n);
  for (let i = 0; i < m.n; i++) {
    const rp = pointAt(ring, m.angles[i]! + rotation);
    const e = easeSymmetric(clamp((p - starts[i]!) / 0.2));
    xs[i] = lerp(rp.x, tgt.xs[i]!, e);
    ys[i] = lerp(rp.y, tgt.ys[i]!, e);
  }
  return { xs, ys };
}

function demandFrame(p: number, w: number, h: number, cls: ViewportClass): Frame | null {
  const m = model(), as = getAnchors();
  if (!m || !as) return null;
  const hingeRot = dial.rot.target || -as[3]!.angle;
  const s = easeSymmetric(windowed(p, 0, 0.3));
  const rotation = lerp(hingeRot, 0, s);
  const morph = windowed(p, MORPH_A, MORPH_B);
  const geom = lerpGeom(ringR1(w, h, cls), ringR0(w, h, cls), s);
  const fanRowsHinge = fanFor(as[3]!, "all");
  const fan = pairChords(fanRowsHinge.map((r) => [r[0], r[1], r[3]] as [number, number, number]));
  const top300 = orbitChords(300) ?? [];
  const fanA = 1 - windowed(p, 0, 0.1);
  const orbA = windowed(p, 0.1, 0.3);
  const chords: Chord[] = [...(fanA > 0 ? fan.map((c) => ({ ...c, alpha: fanA })) : []), ...(orbA > 0 ? top300.map((c) => ({ ...c, alpha: orbA })) : [])];
  const xy = p > MORPH_A ? morphPositions(p, w, h, rotation) ?? undefined : undefined;
  // degraded state (no zone shapes / no WebGL): the landed centroids carry the pickups as square size
  let sizes: Float32Array | undefined;
  const pu = annual("pickups");
  if (p > HANDOFF && !handoff.deckReady && pu) {
    let max = 0;
    for (const v of pu) max = Math.max(max, v);
    const k = windowed(p, HANDOFF, 0.75);
    sizes = Float32Array.from(pu, (v) => lerp(nodeBase(cls), 2 + 12 * Math.sqrt(v / max), k));
  }
  return {
    canvasOpacity: 1, live: false,
    opts: {
      geom, rotation, angles: m.angles, xy, bend: 0.35 * (1 - easeSymmetric(morph)),
      strokeAlpha: 0.9 * (1 - morph), nodeSize: lerp(nodeHorizon(cls), nodeBase(cls), s), sizes, nodeAlpha: 0.9,
      chords, chordAlpha: 0.8, opacity: 1,
    },
  };
}

// ---------------------------------------------------------------- entry
export function sceneFrame(scene: RingScene, p: number, w: number, h: number, now: number, jumped = false): Frame | null {
  const cls = viewportClass(w);
  switch (scene) {
    case "city": return intro.playing ? introFrame(introTime(now), w, h, cls) : cityFrame(p, w, h, cls);
    case "anatomy": return anatomyFrame(p, w, h, cls, now);
    case "rush-hour": return rushFrame(p, w, h, cls, now);
    case "corridors": return corridorsFrame(p, w, h, cls, now, jumped);
    case "demand": return demandFrame(p, w, h, cls);
  }
}

export const bandLabel = (id: string) => (id === "all" ? "ALL HOURS" : (getMeta()?.bands.find((b) => b.id === id)?.label ?? id).toUpperCase());
export const isRingGeom = (g: RingGeom) => g.r > 0;
