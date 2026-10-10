/**
 * Giant ring geometry + Canvas2D renderer (VISUAL_DESIGN 3.2/3.3).
 * Angles are degrees clockwise from 12 o'clock. Geometry is always drawn from
 * (centre, radius, rotation): never by scaling a bitmap.
 */
export type ViewportClass = "D" | "T" | "M";
export interface RingGeom { cx: number; cy: number; r: number }

/** Same cutoffs as the CSS: < 768 M, 768..1023 T, >= 1024 D. */
export const viewportClass = (vw: number): ViewportClass => (vw < 768 ? "M" : vw < 1024 ? "T" : "D");

/**
 * R0 orbit. The design gives exact px for the three reference viewports only
 * (D c 720,450 r 360; T c 384,430 r 300; M c 195,330 r 160); expressed here as
 * viewport fractions so other sizes scale proportionally.
 */
export function ringR0(vw: number, vh: number, cls = viewportClass(vw)): RingGeom {
  if (cls === "D") return { cx: vw / 2, cy: vh / 2, r: vh * 0.4 };
  if (cls === "T") return { cx: vw / 2, cy: vh * (430 / 1024), r: vw * (300 / 768) };
  return { cx: vw / 2, cy: vh * (330 / 844), r: vw * (160 / 390) };
}

/** R1 horizon dial: r = 82vw (D/T) or 130vw (M); arc top at 50/46/52 dvh. */
export function ringR1(vw: number, vh: number, cls = viewportClass(vw)): RingGeom {
  const r = (cls === "M" ? 1.3 : 0.82) * vw;
  const top = vh * (cls === "D" ? 0.5 : cls === "T" ? 0.46 : 0.52);
  return { cx: vw / 2, cy: top + r, r };
}

/** Visible arc span at the viewport edge: 2 * asin((vw / 2) / r), degrees. */
export const arcSpanDeg = (vw: number, r: number) => (2 * Math.asin(Math.min(1, vw / 2 / r)) * 180) / Math.PI;

/** Scrubbed R0 <-> R1 interpolation: radius in log space, centre linear (5.3). */
export function lerpGeom(a: RingGeom, b: RingGeom, s: number): RingGeom {
  return { cx: a.cx + (b.cx - a.cx) * s, cy: a.cy + (b.cy - a.cy) * s, r: a.r * Math.pow(b.r / a.r, s) };
}

export function pointAt(g: RingGeom, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: g.cx + g.r * Math.sin(a), y: g.cy - g.r * Math.cos(a) };
}

/** Evenly spaced angle for node i of n (no borough gaps). */
export const evenAngle = (i: number, n: number) => (i * 360) / n;

/** Rotation that brings `angleDeg` to 12 o'clock. */
export const rotationToTop = (angleDeg: number) => -angleDeg;

/** Quadratic chord control point: k of the way from the chord midpoint to the centre. */
export function chordControl(g: RingGeom, p1: { x: number; y: number }, p2: { x: number; y: number }, k = 0.35) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  return { x: mx + (g.cx - mx) * k, y: my + (g.cy - my) * k };
}

export interface Chord { a: number; b: number; w: number } // node indices, weight 0..1
export interface RingDrawOpts {
  geom: RingGeom;
  rotation: number;
  angles: ArrayLike<number>;
  width: number;
  height: number;
  strokeAlpha?: number;
  nodeSize?: number;
  nodeAlpha?: number;
  /** Per-node size override (e.g. trips at hour); falls back to nodeSize. */
  sizes?: ArrayLike<number>;
  chords?: Chord[];
  chordAlpha?: number;
  /** 0..1 stroke progress for chord draw-in from the anchor (a end). */
  chordDraw?: number;
  /** Dotted tick at 12 o'clock (+ optional fixed square marker there). */
  anchor?: { tick: number; tickProgress?: number; color?: string; outline?: boolean; size?: number };
  /** Coloured 16px markers riding on nodes: they travel with the rotation (reference dial). */
  markers?: { index: number; color: string; outline: boolean; size?: number }[];
  opacity?: number;
}

const BUCKETS = 8;
export const LIGHT_BLUE = "88,184,225";

export function drawRing(ctx: CanvasRenderingContext2D, o: RingDrawOpts) {
  const { geom: g, rotation, angles, width, height } = o;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = o.opacity ?? 1;

  // ring stroke (observed structure: light blue)
  ctx.strokeStyle = `rgba(${LIGHT_BLUE},${o.strokeAlpha ?? 0.9})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
  ctx.stroke();

  const n = angles.length;
  const xs = new Float32Array(n), ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = pointAt(g, angles[i]! + rotation);
    xs[i] = p.x;
    ys[i] = p.y;
  }

  // chords: bucketed by weight, one stroke() per bucket (5.1 performance)
  const chordAlpha = o.chordAlpha ?? 1;
  if (o.chords?.length && chordAlpha > 0.003) {
    const draw = o.chordDraw ?? 1;
    const buckets: Chord[][] = Array.from({ length: BUCKETS }, () => []);
    for (const c of o.chords) buckets[Math.min(BUCKETS - 1, Math.floor(c.w * BUCKETS))]!.push(c);
    ctx.lineCap = "round";
    buckets.forEach((list, bi) => {
      if (!list.length) return;
      const w = (bi + 0.5) / BUCKETS;
      ctx.strokeStyle = `rgba(${LIGHT_BLUE},${(0.06 + 0.44 * w) * chordAlpha})`;
      ctx.lineWidth = 0.5 + 1.5 * w;
      ctx.beginPath();
      for (const c of list) {
        const p1 = { x: xs[c.a]!, y: ys[c.a]! }, p2 = { x: xs[c.b]!, y: ys[c.b]! };
        const cp = chordControl(g, p1, p2);
        ctx.moveTo(p1.x, p1.y);
        if (draw >= 1) ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
        else {
          // partial quadratic (de Casteljau split at t = draw)
          const t = Math.max(0, draw);
          const q0 = { x: p1.x + (cp.x - p1.x) * t, y: p1.y + (cp.y - p1.y) * t };
          const q1 = { x: cp.x + (p2.x - cp.x) * t, y: cp.y + (p2.y - cp.y) * t };
          ctx.quadraticCurveTo(q0.x, q0.y, q0.x + (q1.x - q0.x) * t, q0.y + (q1.y - q0.y) * t);
        }
      }
      ctx.stroke();
    });
  }

  // nodes: square marks, culled to the viewport (the 164vw ring is mostly off-screen)
  const base = o.nodeSize ?? 4;
  ctx.fillStyle = `rgba(255,255,255,${o.nodeAlpha ?? 0.7})`;
  for (let i = 0; i < n; i++) {
    const s = o.sizes ? o.sizes[i]! : base;
    const x = xs[i]!, y = ys[i]!;
    if (x < -s || y < -s || x > width + s || y > height + s) continue;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }

  const square = (x: number, y: number, s: number, color: string, outline?: boolean) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (outline) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
    }
  };
  for (const m of o.markers ?? []) {
    const s = m.size ?? 16;
    const x = xs[m.index]!, y = ys[m.index]!;
    if (x > -s && y > -s && x < width + s && y < height + s) square(x, y, s, m.color, m.outline);
  }

  // dotted vertical tick crossing 12 o'clock
  if (o.anchor) {
    const a = o.anchor;
    const top = { x: g.cx, y: g.cy - g.r };
    const tp = a.tickProgress ?? 1;
    if (tp > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(top.x) + 0.5, top.y - a.tick / 2);
      ctx.lineTo(Math.round(top.x) + 0.5, top.y - a.tick / 2 + a.tick * tp);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (a.color) square(top.x, top.y, a.size ?? 16, a.color, a.outline);
  }
  ctx.restore();
}
