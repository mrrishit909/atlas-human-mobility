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
/**
 * Compact desktop (1024-1279 px wide, e.g. 1024x768): a deliberate composition of its own, not
 * the 1440 layout squeezed. The horizon sits lower and the rush orbit is fitted right of the text.
 */
export const isCompact = (vw: number) => vw >= 1024 && vw < 1280;

export function ringR1(vw: number, vh: number, cls = viewportClass(vw)): RingGeom {
  const r = (cls === "M" ? 1.3 : 0.82) * vw;
  const top = vh * (cls === "D" ? (isCompact(vw) ? 0.64 : 0.5) : cls === "T" ? 0.46 : 0.52);
  return { cx: vw / 2, cy: top + r, r };
}

/** R0c rush orbit (S03a): D c(860, 470) r 380, T c(384, 600) r 300, M c(195, 470) r 168. */
export function ringR0c(vw: number, vh: number, cls = viewportClass(vw)): RingGeom {
  if (cls === "D" && isCompact(vw)) {
    // right of the 380px text column (x 96..476) with a 32px gutter, clear of the edge and the nav
    const x0 = 96 + 380 + 32, x1 = vw - 24;
    const r = Math.min((x1 - x0) / 2, (vh - 96 - 72) / 2);
    return { cx: (x0 + x1) / 2, cy: vh * (470 / 900), r };
  }
  if (cls === "D") return { cx: vw * (860 / 1440), cy: vh * (470 / 900), r: vh * (380 / 900) };
  if (cls === "T") return { cx: vw / 2, cy: vh * (600 / 1024), r: vw * (300 / 768) };
  return { cx: vw / 2, cy: vh * (470 / 844), r: vw * (168 / 390) };
}

export const scaleGeom = (g: RingGeom, k: number): RingGeom => ({ ...g, r: g.r * k });

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

export interface Chord { a: number; b: number; w: number; alpha?: number; draw?: number } // node indices, weight 0..1
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
  /** Coloured 16px markers riding on nodes (index) or ring angles (angle): they travel with the rotation. */
  markers?: { index?: number; angle?: number; color: string; outline: boolean; size?: number }[];
  /** Per-node screen positions (ring-to-map morph); overrides the circle placement. */
  xy?: { xs: Float32Array; ys: Float32Array };
  /** Chord bend toward the centre (0.35 on the ring, 0 = straight centroid-to-centroid). */
  bend?: number;
  /** Per-node alpha multipliers (intro ignition). */
  nodeAlphas?: ArrayLike<number>;
  /** Hollow nodes (zero trips) draw as a 1px outline instead of disappearing. */
  hollow?: ArrayLike<number>;
  chordColor?: string;
  opacity?: number;
}

const BUCKETS = 8;
export const LIGHT_BLUE = "88,184,225";

export function drawRing(ctx: CanvasRenderingContext2D, o: RingDrawOpts, clear = true) {
  const { geom: g, rotation, angles, width, height } = o;
  if (clear) ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = o.opacity ?? 1;

  // ring stroke (observed structure: light blue)
  if ((o.strokeAlpha ?? 0.9) > 0.003) {
    ctx.strokeStyle = `rgba(${LIGHT_BLUE},${o.strokeAlpha ?? 0.9})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const n = angles.length;
  let xs: Float32Array, ys: Float32Array;
  if (o.xy) ({ xs, ys } = o.xy);
  else {
    xs = new Float32Array(n);
    ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pointAt(g, angles[i]! + rotation);
      xs[i] = p.x;
      ys[i] = p.y;
    }
  }
  const bend = o.bend ?? 0.35;
  const color = o.chordColor ?? LIGHT_BLUE;

  // chords: bucketed by weight, one stroke() per bucket (5.1 performance). Chords with
  // their own alpha or partial draw (ignition, fan draw-in) are stroked individually.
  const chordAlpha = o.chordAlpha ?? 1;
  if (o.chords?.length && chordAlpha > 0.003) {
    const global = o.chordDraw ?? 1;
    const buckets: Chord[][] = Array.from({ length: BUCKETS }, () => []);
    const singles: Chord[] = [];
    for (const c of o.chords) {
      if (c.alpha !== undefined || c.draw !== undefined || global < 1) singles.push(c);
      else buckets[Math.min(BUCKETS - 1, Math.floor(c.w * BUCKETS))]!.push(c);
    }
    ctx.lineCap = "round";
    const path = (c: Chord) => {
      const p1 = { x: xs[c.a]!, y: ys[c.a]! }, p2 = { x: xs[c.b]!, y: ys[c.b]! };
      const cp = chordControl(g, p1, p2, bend);
      ctx.moveTo(p1.x, p1.y);
      const t = Math.min(global, c.draw ?? 1);
      if (t >= 1) ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
      else if (t > 0) {
        const q0 = { x: p1.x + (cp.x - p1.x) * t, y: p1.y + (cp.y - p1.y) * t };
        const q1 = { x: cp.x + (p2.x - cp.x) * t, y: cp.y + (p2.y - cp.y) * t };
        ctx.quadraticCurveTo(q0.x, q0.y, q0.x + (q1.x - q0.x) * t, q0.y + (q1.y - q0.y) * t);
      }
    };
    buckets.forEach((list, bi) => {
      if (!list.length) return;
      const w = (bi + 0.5) / BUCKETS;
      ctx.strokeStyle = `rgba(${color},${(0.06 + 0.44 * w) * chordAlpha})`;
      ctx.lineWidth = 0.5 + 1.5 * w;
      ctx.beginPath();
      list.forEach(path);
      ctx.stroke();
    });
    for (const c of singles) {
      const a = (0.06 + 0.44 * c.w) * chordAlpha * (c.alpha ?? 1);
      if (a < 0.003) continue;
      ctx.strokeStyle = `rgba(${color},${a})`;
      ctx.lineWidth = 0.5 + 1.5 * c.w;
      ctx.beginPath();
      path(c);
      ctx.stroke();
    }
  }

  // nodes: square marks, culled to the viewport (the 164vw ring is mostly off-screen)
  const base = o.nodeSize ?? 4;
  const na = o.nodeAlpha ?? 0.7;
  ctx.fillStyle = `rgba(255,255,255,${na})`;
  ctx.strokeStyle = `rgba(255,255,255,${na})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const s = o.sizes ? o.sizes[i]! : base;
    const x = xs[i]!, y = ys[i]!;
    if (x < -s || y < -s || x > width + s || y > height + s) continue;
    const ia = o.nodeAlphas ? o.nodeAlphas[i]! : 1;
    if (ia <= 0.003) continue;
    if (ia < 1) ctx.globalAlpha = (o.opacity ?? 1) * ia;
    if (o.hollow?.[i]) ctx.strokeRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 3, 3);
    else ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (ia < 1) ctx.globalAlpha = o.opacity ?? 1;
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
    const pt = m.angle !== undefined ? pointAt(g, m.angle + rotation) : { x: xs[m.index ?? 0]!, y: ys[m.index ?? 0]! };
    const x = pt.x, y = pt.y;
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

/** Point on a quadratic chord at t (for pulses and tickets). */
export function quadPoint(p1: { x: number; y: number }, cp: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * p1.x + 2 * u * t * cp.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * cp.y + t * t * p2.y };
}

/** First t in [0, 1] where a quadratic crosses y = Y (exit through the bottom edge), or null. */
export function quadCrossY(p1: { y: number }, cp: { y: number }, p2: { y: number }, Y: number): number | null {
  const a = p1.y - 2 * cp.y + p2.y, b = 2 * (cp.y - p1.y), c = p1.y - Y;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) roots.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); roots.push((-b - s) / (2 * a), (-b + s) / (2 * a)); }
  }
  const ok = roots.filter((t) => t >= 0 && t <= 1).sort((x, y) => x - y);
  return ok[0] ?? null;
}

/**
 * Pulses: 3px square head with a fading 24px tail along a chord, additive.
 * Motion-only (orange in OBSERVED scenes never appears as a static mark).
 */
export function drawPulse(ctx: CanvasRenderingContext2D, p1: { x: number; y: number }, cp: { x: number; y: number }, p2: { x: number; y: number }, t: number, len: number) {
  if (t <= 0 || t > 1) return;
  const tail = Math.min(t, 24 / Math.max(1, len));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  const steps = 8;
  for (let i = steps; i >= 1; i--) {
    const q = quadPoint(p1, cp, p2, t - (tail * i) / steps);
    ctx.fillStyle = `rgba(255,76,37,${0.5 * (1 - i / steps)})`;
    ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
  }
  const h = quadPoint(p1, cp, p2, t);
  ctx.fillStyle = "#fff";
  ctx.fillRect(h.x - 1.5, h.y - 1.5, 3, 3);
  ctx.globalCompositeOperation = prev;
}

/** Approximate chord length (for constant-speed pulses). */
export function quadLength(p1: { x: number; y: number }, cp: { x: number; y: number }, p2: { x: number; y: number }) {
  let L = 0, prev = p1;
  for (let i = 1; i <= 8; i++) { const q = quadPoint(p1, cp, p2, i / 8); L += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
  return L;
}
