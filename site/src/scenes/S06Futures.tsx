import { useEffect, useMemo, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { Tooltip } from "../components/Tooltip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { bprFit, zoneHourWeek } from "../data/types";
import { FUTURES, copyS06, futureLine, mph, signed } from "../data/copy";
import { howLabel, labResult, type BoroughFit } from "../data/bpr";
import { lab, labChanged, labHow } from "../state/lab";
import { model, useAtlas, zhwIndex, getZhw } from "../state/atlas";
import { useFrame, useMotion, useProgress } from "../scroll/hooks";
import { fitCanvas, stageW } from "../graphics/canvas";
import { isCompact, viewportClass, type ViewportClass } from "../graphics/ring";
import { clamp, lerp } from "../lib/math";
import { easeSmooth, easeSymmetric } from "../motion/ease";
import { windowed } from "../motion/progress";
import { motionEnabled } from "../state/motion";
import type { RingModel } from "../data/derive";

type FutureId = (typeof FUTURES)[number]["id"];
const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

export function futureParams(id: FutureId) {
  const f = FUTURES.find((x) => x.id === id)!;
  return id === "yours" ? { dm: lab.dm, cm: lab.cm } : { dm: f.dm, cm: f.cm };
}

/** Per-borough minutes added at an hour-of-week (trip-weighted by baseline volume for the citywide figure). */
export function boroughDeltas(fits: Record<string, BoroughFit>, how: number, dm: number, cm: number) {
  const rows = BOROUGHS.flatMap((b) => {
    const f = fits[b];
    const r = f ? labResult(f, how, dm, cm) : null;
    return r ? [{ borough: b, obsMin: r.obsMin, simMin: r.simMin, delta: r.simMin - r.obsMin, ratio: r.simSpeed / r.obsSpeed, v: f!.baseline[how]!.v }] : [];
  });
  const vSum = rows.reduce((s, r) => s + r.v, 0);
  const city = vSum > 0 ? rows.reduce((s, r) => s + r.delta * r.v, 0) / vSum : 0;
  return { rows, city };
}

/** Max drawn outward swell (px) = 40 px x 1.2 TTI; larger deltas are drawn at the limit (noted on screen). */
export const SWELL = 48;
type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * The ring is fitted into the space the text leaves free (measured from the DOM, in canvas
 * coordinates), so at no viewport does it cross a text block. D: between the left column and the
 * minutes list. T/M: between the text above and the minutes list / selector below.
 */
function freeBox(canvas: HTMLCanvasElement, cls: ViewportClass, motion: boolean): Box {
  const c = canvas.getBoundingClientRect();
  const full = { x0: 16, y0: 16, x1: c.width - 16, y1: c.height - 16 };
  if (!motion) return full;
  const stage = canvas.parentElement!;
  const r = (sel: string) => { const e = stage.querySelector(sel)?.getBoundingClientRect(); return e ? { l: e.left - c.left, t: e.top - c.top, r: e.right - c.left, b: e.bottom - c.top } : null; };
  const text = r(".fut-text"), deltas = r(".fut-deltas"), select = r(".fut-select");
  // compact desktop: text and minutes list stacked on the left, the ring fills the right
  if (cls === "D" && isCompact(c.width)) return { x0: Math.max(text?.r ?? 0, deltas?.r ?? 0) + 32, x1: c.width - 24, y0: 48, y1: (select?.t ?? c.height) - 24 };
  if (cls === "D") return { x0: (text?.r ?? 0) + 32, x1: (deltas?.l ?? c.width) - 32, y0: 48, y1: (select?.t ?? c.height) - 24 };
  return { x0: 16, x1: c.width - 16, y0: (text?.b ?? 0) + 20, y1: Math.min(deltas?.t ?? c.height, select?.t ?? c.height) - 16 };
}

/** R2 split ring inside the free box: D/T side by side, M rotated (observed top, simulated bottom). */
function halves(box: Box, cls: ViewportClass, gap: number) {
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  if (cls === "M") {
    const r = Math.max(40, Math.min((bw - 2 * SWELL) / 2, (bh - gap - SWELL) / 2));
    const cx = (box.x0 + box.x1) / 2, cy = box.y0 + r + gap / 2;
    return { r, obs: { cx, cy: cy - gap / 2 }, sim: { cx, cy: cy + gap / 2 }, rotated: true };
  }
  const r = Math.max(60, Math.min((bw - gap - SWELL) / 2, (bh - 2 * SWELL) / 2, cls === "D" ? 340 : 280));
  const cx = box.x0 + (bw - SWELL) / 2, cy = (box.y0 + box.y1) / 2;
  return { r, obs: { cx: cx - gap / 2, cy }, sim: { cx: cx + gap / 2, cy }, rotated: false };
}
/** Zone angle on each half: mirrored so a zone sits at the same height on both sides. */
const angleOn = (a: number, side: "obs" | "sim", rotated: boolean) => {
  const half = a / 2;
  if (!rotated) return side === "obs" ? 360 - half : half;
  return side === "obs" ? 270 + half : 270 - half;
};
const pt = (c: { cx: number; cy: number }, r: number, deg: number) => { const t = (deg * Math.PI) / 180; return { x: c.cx + r * Math.sin(t), y: c.cy - r * Math.cos(t) }; };

interface ZoneDelta { obsSpeed: number; simSpeed: number; delta: number }
function zoneDeltas(m: RingModel, how: number, ratioOf: (b: string) => number): (ZoneDelta | null)[] {
  const z = getZhw(), idx = zhwIndex();
  if (!z || !idx) return [];
  return m.ids.map((loc, i) => {
    const zi = idx.get(loc);
    if (zi === undefined) return null;
    const s = z.speed_mph.all[zi * 168 + how], ff = z.free_flow_mph[zi];
    if (s === null || s === undefined || !ff) return null;
    const sim = s * ratioOf(m.borough[i]!);
    return { obsSpeed: s, simSpeed: sim, delta: ff / sim - ff / s };
  });
}

let hatch: CanvasPattern | null = null;
function hatchPattern(ctx: CanvasRenderingContext2D) {
  if (hatch) return hatch;
  const c = document.createElement("canvas");
  c.width = c.height = 6;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255,76,37,0.45)";
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 6); g.lineTo(6, 0); g.stroke();
  return (hatch = ctx.createPattern(c, "repeat"));
}

/** S06 Alternative Futures: observed half-ring vs simulated half-ring, per-zone radial swelling. */
export function S06Futures({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [fitS, retryFit] = useArtifact(bprFit);
  const [zhw, retryZ] = useArtifact(zoneHourWeek);
  const [future, setFuture] = useState<FutureId>("busier");
  const [tip, setTip] = useState<{ x: number; y: number; i: number }>({ x: 0, y: 0, i: -1 });
  const [hourOpen, setHourOpen] = useState(false);
  // M rotates the split: the observed half is on top (QA D-032)
  const [phone, setPhone] = useState(() => viewportClass(stageW()) === "M");
  const canvas = useRef<HTMLCanvasElement>(null);
  const prog = useRef(0);
  const blend = useRef({ from: [] as number[], to: [] as number[], at: -1e9 });
  const dirty = useRef(true);
  const fits = fitS.status === "ready" ? fitS.data.boroughs : null;
  const m = model();
  const how = labHow();
  const yoursOk = labChanged();
  const active: FutureId = future === "yours" && !yoursOk ? "busier" : future;
  const { dm, cm } = futureParams(active);
  const deltas = fits ? boroughDeltas(fits, how, dm, cm) : null;
  const line = deltas ? futureLine(deltas.rows, howLabel(how)) : null;
  const zones = useMemo(() => (m && deltas ? zoneDeltas(m, how, (b) => deltas.rows.find((r) => r.borough === b)?.ratio ?? 1) : []), [m, deltas, how]);
  const excluded = zones.filter((z) => z === null).length;
  const clipped = zones.filter((z) => z !== null && z.delta * 40 > SWELL).length;
  const copy = copyS06();

  // keyed 600ms tween of each zone's radial offset when the future / hour changes
  useEffect(() => {
    const to = zones.map((z) => (z ? z.delta : 0));
    const b = blend.current;
    const now = performance.now();
    const e = easeSmooth(clamp((now - b.at) / 600));
    b.from = b.to.length ? b.to.map((v, i) => lerp(b.from[i] ?? v, v, e)) : to;
    b.to = to;
    b.at = motionEnabled() ? now : -1e9;
    dirty.current = true;
  }, [zones]);
  useProgress(id, (p) => { prog.current = p; dirty.current = true; });
  // the ring is fitted around the text, so any layout change re-fits it
  useEffect(() => {
    const mark = () => { dirty.current = true; setPhone(viewportClass(stageW()) === "M"); };
    addEventListener("resize", mark);
    void document.fonts?.ready.then(mark);
    return () => removeEventListener("resize", mark);
  }, []);
  useEffect(() => { dirty.current = true; });

  useFrame((now) => {
    const c = canvas.current;
    if (!c || !m) return;
    const b = blend.current;
    const moving = now - b.at < 650;
    if (!dirty.current && !moving) return;
    dirty.current = false;
    const { ctx, width: w, height: h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const cls = viewportClass(motion ? stageW() : w);
    const p = motion ? prog.current : 0.5;
    const open = motion ? easeSymmetric(windowed(p, 0, 0.15)) : 1;
    const exit = motion ? easeSymmetric(windowed(p, 0.9, 1)) : 0;
    const geo = halves(freeBox(c, cls, motion), cls, 40 * open + 160 * exit);
    ctx.globalAlpha = 1 - exit;
    const e = easeSmooth(clamp((now - b.at) / 600));
    const off = (i: number) => Math.min(SWELL, lerp(b.from[i] ?? 0, b.to[i] ?? 0, e) * 40);
    // observed half: light-blue arc + solid nodes at the base radius
    ctx.strokeStyle = "rgba(88,184,225,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 90; k++) { const q = pt(geo.obs, geo.r, angleOn((k / 90) * 360, "obs", geo.rotated)); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    const sz = cls === "M" ? 3 : 4;
    for (let i = 0; i < m.n; i++) {
      const q = pt(geo.obs, geo.r, angleOn(m.angles[i]!, "obs", geo.rotated));
      if (zones[i]) { ctx.fillStyle = "#58B8E1"; ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz); }
      else { ctx.strokeStyle = "rgba(88,184,225,0.7)"; ctx.strokeRect(q.x - 1.5, q.y - 1.5, 3, 3); }
    }
    // simulated half: base arc (dashed), displaced outline (dashed orange), hatch between them
    const base: { x: number; y: number }[] = [], swell: { x: number; y: number }[] = [];
    const order = Array.from({ length: m.n }, (_, i) => i).sort((a, b2) => m.angles[a]! - m.angles[b2]!);
    for (const i of order) {
      const a = angleOn(m.angles[i]!, "sim", geo.rotated);
      base.push(pt(geo.sim, geo.r, a));
      swell.push(pt(geo.sim, geo.r + (zones[i] ? off(i) : 0), a));
    }
    ctx.save();
    ctx.beginPath();
    swell.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    for (let k = base.length - 1; k >= 0; k--) ctx.lineTo(base[k]!.x, base[k]!.y);
    ctx.closePath();
    ctx.fillStyle = hatchPattern(ctx) ?? "rgba(255,76,37,0.15)";
    ctx.fill();
    ctx.restore();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(255,76,37,0.5)";
    ctx.beginPath(); base.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    ctx.strokeStyle = "#FF4C25";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); swell.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < order.length; k++) {
      const i = order[k]!, q = swell[k]!;
      if (zones[i]) { ctx.fillStyle = "#FF4C25"; ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz); }
      else { ctx.strokeStyle = "rgba(255,76,37,0.7)"; ctx.strokeRect(q.x - 1.5, q.y - 1.5, 3, 3); }
    }
    // drawn extent in viewport coordinates (Playwright: the ring never intersects a text block)
    const cr = c.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of [...swell, ...base]) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    for (let k = 0; k <= 90; k++) { const q = pt(geo.obs, geo.r, angleOn((k / 90) * 360, "obs", geo.rotated)); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    c.dataset.bbox = JSON.stringify([x0 + cr.left - 3, y0 + cr.top - 3, x1 + cr.left + 3, y1 + cr.top + 3].map(Math.round));
    if (tip.i >= 0) {
      const q = pt(geo.sim, geo.r + off(tip.i), angleOn(m.angles[tip.i]!, "sim", geo.rotated));
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(q.x - 6, q.y - 6, 12, 12);
    }
    ctx.globalAlpha = 1;
  });

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!m) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const w = rect.width;
    const geo = halves(freeBox(e.currentTarget, viewportClass(motion ? stageW() : w), motion), viewportClass(motion ? stageW() : w), 40);
    let best = -1, bd = 14;
    for (let i = 0; i < m.n; i++) {
      for (const side of ["obs", "sim"] as const) {
        const q = pt(geo[side], geo.r + (side === "sim" ? Math.min(SWELL, (blend.current.to[i] ?? 0) * 40) : 0), angleOn(m.angles[i]!, side, geo.rotated));
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < bd) { bd = d; best = i; }
      }
    }
    setTip({ x: e.clientX, y: e.clientY, i: best });
    dirty.current = true;
  };

  const rowH = viewportClass(typeof document !== "undefined" ? stageW() : 1440) === "D" ? 40 : viewportClass(stageW()) === "T" ? 22 : 18;
  const maxAbs = Math.max(0.1, ...(deltas?.rows.map((r) => Math.abs(r.delta)) ?? [0.1]));
  const sorted = deltas ? [...deltas.rows].sort((a, b) => b.delta - a.delta) : [];
  const z = tip.i >= 0 ? zones[tip.i] : null;

  return (
    <Track id={id} height={height} landing={landing} label="Alternative futures" className="scene scene-futures">
      <canvas ref={canvas} className="fut-canvas" onPointerMove={onMove} onPointerLeave={() => { setTip((t) => ({ ...t, i: -1 })); dirty.current = true; }}
        role="img" aria-label="Split ring: observed speeds on one half, the simulated future on the other; zones swell outward where the future is slower" />
      <div className="fut-text">
        <p className="scene-kicker">07 · ALTERNATIVE FUTURES</p>
        <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement" text={copy.statement}
          mode={motion ? { kind: "scrub", track: id, from: 0, to: 0.08 } : { kind: "value", t: 1 }} /* ends before the 0.10 landing */ />
        {line && <p className="fut-callout" data-testid="fut-line">{line}</p>}
        <div className="cor-chips">
          <HonestyChip tag="OBSERVED" detail={phone ? "TOP HALF" : "LEFT HALF"} />
          <HonestyChip tag="SIMULATED" detail={copy.chip} />
        </div>
        <p className="mono-label fut-caption">{copy.caption}</p>
        {clipped > 0 && <p className="scene-note">{clipped} ZONES SLOW BY MORE THAN +1.2 TRAVEL-TIME INDEX; DRAWN AT THE RIM LIMIT.</p>}
        <div className="fut-hour">
          <button type="button" className="btn-square" aria-expanded={hourOpen} onClick={() => setHourOpen((o) => !o)}>{howLabel(how)}</button>
          {hourOpen && <span className="mono-label">THE HOUR IS SET IN THE PRESSURE LAB</span>}
        </div>
        {excluded > 0 && <p className="scene-note">{excluded} ZONES WITHOUT TRIPS AT THIS HOUR EXCLUDED (HOLLOW).</p>}
        {fitS.status === "loading" && <LoadingLine file="bpr_fit.json" loaded={fitS.loaded} total={fitS.total} />}
        {fitS.status === "error" && <ErrorLine file="bpr_fit.json" reason={fitS.reason} attempt={fitS.attempt} onRetry={retryFit} />}
        {zhw.status === "loading" && <LoadingLine file="zone_hour_week.json" loaded={zhw.loaded} total={zhw.total} />}
        {zhw.status === "error" && <ErrorLine file="zone_hour_week.json" reason={zhw.reason} attempt={zhw.attempt} onRetry={retryZ} />}
      </div>

      <div role="radiogroup" aria-label="Future" className="seg-ctl fut-select" onKeyDown={(e) => {
        // ARIA radio pattern (QA D-012): arrows move the selection, skipping the disabled option
        const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const ids = FUTURES.map((x) => x.id).filter((x) => x !== "yours" || yoursOk);
        const next = ids[(ids.indexOf(active) + d + ids.length) % ids.length]!;
        setFuture(next);
        (e.currentTarget.querySelector(`[data-id="${next}"]`) as HTMLElement | null)?.focus();
      }}>
        {FUTURES.map((x) => {
          const dis = x.id === "yours" && !yoursOk;
          return (
            <button key={x.id} type="button" role="radio" data-id={x.id} tabIndex={active === x.id ? 0 : -1} aria-checked={active === x.id} aria-disabled={dis} title={dis ? "SET A SCENARIO IN PRESSURE FIRST" : undefined}
              className={`seg-ctl__item fut-item ${dis ? "is-disabled" : ""}`} onClick={() => !dis && setFuture(x.id)}>
              {x.label}<small>{x.id === "yours" && yoursOk ? `x${lab.dm.toFixed(2)} · ${signed((lab.cm - 1) * 100, 0)}%` : x.sub}</small>
            </button>
          );
        })}
        {!yoursOk && <span className="sr-only">Your future is disabled until you set a scenario in the pressure lab.</span>}
      </div>

      <aside className="fut-deltas" aria-label="Minutes added per trip, by borough">
        <p className="mono-label">MINUTES ADDED TO A MEDIAN TRIP · {howLabel(how)}</p>
        <ol style={{ height: sorted.length * rowH }}>
          {deltas?.rows.map((r) => {
            const rank = sorted.findIndex((s) => s.borough === r.borough);
            return (
              <li key={r.borough} style={{ transform: `translateY(${rank * rowH}px)` }}>
                <span>{r.borough.toUpperCase()}</span>
                <span className="tnum fut-num">{signed(r.delta)} MIN</span>
                <i className="fut-bar" style={{ transform: `scaleX(${(Math.abs(r.delta) / maxAbs).toFixed(3)})` }} />
              </li>
            );
          })}
        </ol>
        {deltas && <p className="mono-label fut-city">CITYWIDE, TRIP-WEIGHTED: <span className="tnum">{signed(deltas.city)} MIN</span></p>}
        <div className="sr-only">{/* a 1px clipping box: a table cannot shrink below its content width */}
          <table>
            <caption>Observed and simulated median trip minutes by borough</caption>
            <thead><tr><th>Borough</th><th>Observed minutes</th><th>Simulated minutes</th></tr></thead>
            <tbody>{deltas?.rows.map((r) => <tr key={r.borough}><td>{r.borough}</td><td>{r.obsMin.toFixed(1)}</td><td>{r.simMin.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </div>
      </aside>

      {z && m && (
        <Tooltip x={tip.x} y={tip.y} visible>
          {m.name[tip.i]!.toUpperCase()}<br />OBSERVED {mph(z.obsSpeed)} MPH / SIMULATED {mph(z.simSpeed)} MPH
        </Tooltip>
      )}
    </Track>
  );
}
