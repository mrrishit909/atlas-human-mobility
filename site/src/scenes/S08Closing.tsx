import { useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { useArtifact } from "../data/useArtifact";
import { facts, meta } from "../data/types";
import { copyS08 } from "../data/copy";
import { model, useAtlas } from "../state/atlas";
import { useFrame, useMotion, useProgress } from "../scroll/hooks";
import { fitCanvas, stageW } from "../graphics/canvas";
import { chordControl, drawPulse, pointAt, quadLength, viewportClass, type RingGeom } from "../graphics/ring";
import { clamp } from "../lib/math";
import { easePremium, easeSmooth, easeSymmetric } from "../motion/ease";
import { windowed } from "../motion/progress";
import { motionEnabled } from "../state/motion";
import { jumpTo } from "../scroll/engine";
import { REPO } from "./S07Evidence";

const ECHO = 0.75;
/** R3 closing horizon (VISUAL_DESIGN 3.3): rises from below to its resting top. */
function r3(w: number, h: number, p: number): RingGeom {
  const cls = viewportClass(w);
  const r = cls === "M" ? 1.3 * w : 0.82 * w;
  const rest = cls === "D" ? (700 / 900) * h : cls === "T" ? (760 / 1024) * h : (640 / 844) * h;
  const top = h + 40 + (rest - h - 40) * easeSymmetric(windowed(p, 0.2, 0.6));
  return { cx: w / 2, cy: top + r, r };
}

/** S08 Conclusion: the horizon returns with a spectral rim, and the opening signal echoes once. */
export function S08Closing({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [m] = useArtifact(meta);
  const canvas = useRef<HTMLCanvasElement>(null);
  const prog = useRef(motion ? 0 : 1);
  const echo = useRef({ at: -1e9, armed: true });
  const [echoed, setEchoed] = useState(!motion);
  const [linksIn, setLinksIn] = useState(!motion);
  const copy = f.status === "ready" ? copyS08(f.data) : null;

  useProgress(id, (p) => {
    prog.current = p;
    // the echo plays once per down-crossing; rearmed only above the threshold minus hysteresis
    if (p >= ECHO && echo.current.armed) { echo.current = { at: performance.now(), armed: false }; }
    if (p < ECHO - 0.02 && !echo.current.armed) { echo.current.armed = true; setEchoed(false); }
    setLinksIn(p >= 0.8 || !motion);
  });

  useFrame((now) => {
    const c = canvas.current, mm = model();
    if (!c || !mm || !f.status || f.status !== "ready") return;
    const p = motion ? prog.current : 1;
    const since = motionEnabled() ? now - echo.current.at : 1e9;
    const live = since < 2600;
    if (!live && c.dataset.p === p.toFixed(4) && c.dataset.w === String(c.clientWidth)) return;
    c.dataset.p = p.toFixed(4);
    c.dataset.w = String(c.clientWidth);
    const { ctx, width: w, height: h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const g = r3(motion ? stageW() : w, h, motion ? p : 1);
    // spectral rim: layered strokes, the only light in the scene (one luminous form)
    const bright = since < 600 ? easeSmooth(since / 600) * 0.4 : since < 1800 ? 0.4 * (1 - easeSmooth((since - 600) / 1200)) : 0;
    const grad = ctx.createLinearGradient(0, g.cy - g.r, w, g.cy - g.r);
    grad.addColorStop(0, "#c21fd6"); grad.addColorStop(0.35, "#ff2f7a"); grad.addColorStop(0.65, "#ff6a2b"); grad.addColorStop(1, "#ffb26b");
    for (const [lw, a] of [[48, 0.08], [24, 0.14], [10, 0.25], [3, 0.6], [1, 1]] as const) {
      ctx.strokeStyle = grad;
      ctx.globalAlpha = Math.min(1, a * (1 + bright * 2.5));
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, Math.PI, 2 * Math.PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the echo: the busiest pair of S00 crosses the horizon once (DERIVED caption after it lands)
    const a = mm.idx.get(f.data.top_od_pair.o), b = mm.idx.get(f.data.top_od_pair.d);
    if (a !== undefined && b !== undefined && (since < 1e8 || !motionEnabled())) {
      const p1 = pointAt(g, mm.angles[a]!), p2 = pointAt(g, mm.angles[b]!);
      // the busiest corridor is a short hop (adjacent zones): bow it 140px outward so it reads
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, ref = chordControl(g, p1, p2, 1);
      const len = Math.hypot(ref.x - mid.x, ref.y - mid.y) || 1;
      const cp = { x: mid.x - ((ref.x - mid.x) / len) * 140, y: mid.y - ((ref.y - mid.y) / len) * 140 };
      const draw = motionEnabled() ? easePremium(clamp(since / 800)) : 1;
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
      const t = draw, q0 = { x: p1.x + (cp.x - p1.x) * t, y: p1.y + (cp.y - p1.y) * t }, q1 = { x: cp.x + (p2.x - cp.x) * t, y: cp.y + (p2.y - cp.y) * t };
      ctx.quadraticCurveTo(q0.x, q0.y, q0.x + (q1.x - q0.x) * t, q0.y + (q1.y - q0.y) * t);
      ctx.stroke();
      for (const q of [p1, p2]) { ctx.fillStyle = "#fff"; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
      if (motionEnabled() && since < 2000) drawPulse(ctx, p1, cp, p2, clamp((since - 400) / 1200), quadLength(p1, cp, p2));
      if (since > 1600 && !echoed) setEchoed(true);
    }
  });

  return (
    <Track id={id} height={height} landing={landing} label="Closing" className="scene scene-closing">
      <canvas ref={canvas} className="end-canvas" aria-hidden="true" />
      <div className="end-text">
        <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="end-para" text={copy?.paragraph ?? ""}
          mode={motion ? { kind: "scrub", track: id, from: 0.3, to: 0.7 } : { kind: "value", t: 1 }} />
        {copy && (echoed || !motion) && <p className="end-caption"><HonestyChip tag="DERIVED" /> {copy.caption}</p>}
        <nav className={`end-links ${linksIn ? "is-in" : ""}`} aria-label="Next">
          <a href="#observatory" onClick={(e) => { e.preventDefault(); jumpTo("observatory", 0, { push: true, focus: true }); }}>→ OPEN THE OBSERVATORY</a>
          <button type="button" onClick={() => dispatchEvent(new Event("atlas:replay"))}>→ REPLAY THE INTRO</button>
          <a href={`${REPO}/blob/main/docs/METHODOLOGY.md`} target="_blank" rel="noopener">→ READ THE METHODOLOGY</a>
          <a href={REPO} target="_blank" rel="noopener">→ SOURCE CODE</a>
        </nav>
        <p className="end-foot">
          DATA: NYC TAXI AND LIMOUSINE COMMISSION TRIP RECORDS, 2024 · NOAA GHCN-DAILY, CENTRAL PARK · TLC MAKES NO REPRESENTATION AS TO THE ACCURACY OF THESE DATA · GENERATED {m.status === "ready" ? m.data.generated_at.slice(0, 10) : ""} · RISHIT MATHUR
        </p>
      </div>
    </Track>
  );
}
