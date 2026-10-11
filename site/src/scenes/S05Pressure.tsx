import { useEffect, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { Orb } from "../components/Orb";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { bprFit, facts, zoneHourWeek } from "../data/types";
import { copyS05, mph } from "../data/copy";
import { howLabel, labResult, tti, type BoroughFit } from "../data/bpr";
import { lab, labHow, resetLab, setLab } from "../state/lab";
import { useAtlas } from "../state/atlas";
import { useMotion, useProgress } from "../scroll/hooks";
import { useTweened } from "../motion/useTweened";
import { clamp } from "../lib/math";
import { FactsState } from "./FactsState";
import { Segmented } from "./S03aRush";
import { SPEED_STEPS, speedStep } from "./mapStyle";

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const SHORT: Record<string, string> = { Manhattan: "MN", Brooklyn: "BK", Queens: "QN", Bronx: "BX", "Staten Island": "SI" };
const LAB_AT = 0.35;

/** Borough with the highest PM-peak volume: the reset borough (VISUAL_DESIGN S05 Reset). */
export function defaultBorough(fit: Record<string, BoroughFit>, pmHour: number) {
  let best = "Manhattan", v = -1;
  for (const [b, f] of Object.entries(fit)) { const x = f.baseline[2 * 24 + pmHour]?.v ?? 0; if (x > v) { v = x; best = b; } }
  return best;
}

/** The BPR stage: binned observations, fitted curve (DERIVED), scenario curve + operating point (SIMULATED). */
function BprStage({ fit, dm, cm, how }: { fit: BoroughFit; dm: number; cm: number; how: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 744, h: 520 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // every visual parameter tweens 600ms smooth; the point is recomputed ON the curve (never leaves it)
  const a = useTweened(fit.alpha), b = useTweened(fit.beta), d = useTweened(dm), c = useTweened(cm);
  const x0 = useTweened(fit.baseline[how]?.x ?? 0);
  const xMaxObs = fit.x_max_observed;
  const xop = x0 * d;
  const ttiS = (x: number) => tti(x / c, a, b);
  const XMAX = Math.max(2, xop * 1.1);
  let ymax = 3;
  for (let i = 0; i <= 60; i++) ymax = Math.max(ymax, ttiS((XMAX * i) / 60), tti((XMAX * i) / 60, a, b));
  for (const p of fit.binned_points) ymax = Math.max(ymax, p.tti);
  const { w, h } = size;
  const L = 8, R = 8, T = 28, B = 28;
  const X = (x: number) => L + (x / XMAX) * (w - L - R);
  const Y = (y: number) => h - B - ((y - 1) / (ymax - 1)) * (h - T - B);
  const curve = (f: (x: number) => number, from: number, to: number) => {
    let s = "";
    for (let i = 0; i <= 120; i++) { const x = from + ((to - from) * i) / 120; s += `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(f(x)).toFixed(1)}`; }
    return s;
  };
  const fitted = (x: number) => tti(x, a, b);
  const showScenario = Math.abs(c - 1) > 0.001;
  const opY = ttiS(xop);
  const pressure = clamp(opY - 1, 0, 2);
  return (
    <div className="bpr-stage" ref={box}>
      <div className="bpr-glow" style={{ left: X(xop), top: Y(opY), transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * pressure).toFixed(3)})`, opacity: (0.15 + 0.35 * pressure).toFixed(3) }} aria-hidden="true">
        <Orb family="solar" size={120} />
      </div>
      <svg width={w} height={h} role="img" aria-label="BPR travel-time index against volume over capacity, with the observed binned points, the fitted curve and the scenario operating point">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={L} x2={w - R} y1={Y(1 + f * (ymax - 1))} y2={Y(1 + f * (ymax - 1))} className="bpr-hair" />)}
        {fit.binned_points.map((p, i) => <rect key={i} x={X(p.x) - 1.5} y={Y(p.tti) - 1.5} width="3" height="3" fill="#fff" />)}
        <path d={curve(fitted, 0, Math.min(XMAX, xMaxObs))} className="bpr-fit" />
        <path d={curve(fitted, Math.min(XMAX, xMaxObs), XMAX)} className="bpr-fit bpr-fit--beyond" />
        {showScenario && <path d={curve(ttiS, 0, XMAX)} className="bpr-scenario" />}
        <line x1={X(xop)} x2={X(xop)} y1={Y(opY) - 60} y2={Math.min(h - B, Y(opY) + 60)} className="bpr-tick" />
        <rect x={X(xop) - 8} y={Y(opY) - 8} width="16" height="16" className="bpr-op" />
        <text x={L} y={h - 8} className="bpr-axis">V/C 0</text>
        <text x={w - R} y={h - 8} className="bpr-axis" textAnchor="end">{XMAX.toFixed(1)}</text>
        <text x={L} y={T - 10} className="bpr-axis">TRAVEL-TIME INDEX {ymax.toFixed(1)}</text>
        <text x={X(Math.min(XMAX, xMaxObs))} y={T - 10} className="bpr-axis" textAnchor="middle">MAX OBSERVED</text>
      </svg>
    </div>
  );
}

/** S05 A City Under Pressure: observed pressure on the map, then the live BPR lab. */
export function S05Pressure({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [fitS, retryFit] = useArtifact(bprFit);
  const [zhw] = useArtifact(zoneHourWeek);
  const [inLab, setInLab] = useState(!motion);
  const [sheet, setSheet] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [live, setLive] = useState("");
  const copy = f.status === "ready" ? copyS05(f.data) : null;
  const fits = fitS.status === "ready" ? fitS.data.boroughs : null;

  useProgress(id, (p) => setInLab(!motion || p >= LAB_AT));
  // reset borough = highest PM volume; set once data arrives
  useEffect(() => {
    if (fits && !lab.borough && f.status === "ready") setLab({ borough: defaultBorough(fits, f.data.pm_peak_hour.hour), hour: f.data.am_peak_hour.hour });
  }, [fits, f]);

  const fit = fits?.[lab.borough] ?? null;
  const how = labHow();
  const r = fit ? labResult(fit, how, lab.dm, lab.cm) : null;
  const obsSpeed = useTweened(r?.obsSpeed ?? 0), simSpeed = useTweened(r?.simSpeed ?? 0);
  const obsMin = useTweened(r?.obsMin ?? 0), simMin = useTweened(r?.simMin ?? 0);

  // aria-live result, debounced 400ms after the last change
  const sentence = r && fit ? (r.changed
    ? `Simulated: median speed in ${lab.borough} at ${howLabel(how)} ${r.simSpeed < r.obsSpeed ? "falls" : "rises"} from ${mph(r.obsSpeed)} to ${mph(r.simSpeed)} mph; a ${Math.round(r.obsMin)}-minute trip becomes ${Math.round(r.simMin)} minutes.`
    : `Observed: median speed in ${lab.borough} at ${howLabel(how)} is ${mph(r.obsSpeed)} mph.`) : "";
  useEffect(() => { const t = setTimeout(() => setLive(sentence), 400); return () => clearTimeout(t); }, [sentence]);

  const disabled = !fits;
  const reset = () => {
    if (!fits || f.status !== "ready") return;
    resetLab(defaultBorough(fits, f.data.pm_peak_hour.hour));
    setLab({ hour: f.data.am_peak_hour.hour });
    setResetDone(true);
    setTimeout(() => setResetDone(false), 1200);
  };
  const statement = copy ? (inLab ? copy.s2 : copy.s1) : "";

  const controls = (
    <div className="lab-controls" aria-disabled={disabled}>
      <label className={`lab-range ${disabled ? "is-disabled" : ""}`}>
        <span className="lab-range__label">DEMAND <b className="tnum">x{lab.dm.toFixed(2)}</b></span>
        <input type="range" min={0.5} max={1.5} step={0.05} value={lab.dm} disabled={disabled} aria-valuetext={`times ${lab.dm.toFixed(2)}`}
          onChange={(e) => setLab({ dm: Number(e.target.value) })} />
      </label>
      <label className={`lab-range lab-range--sim ${disabled ? "is-disabled" : ""}`}>
        <span className="lab-range__label">ROAD CAPACITY <b className="tnum">{lab.cm >= 1 ? "+" : ""}{Math.round((lab.cm - 1) * 100)}%</b></span>
        <input type="range" min={-30} max={20} step={5} value={Math.round((lab.cm - 1) * 100)} disabled={disabled} aria-valuetext={`${Math.round((lab.cm - 1) * 100)} percent`}
          onChange={(e) => setLab({ cm: 1 + Number(e.target.value) / 100 })} />
      </label>
      <div className={`lab-more ${sheet ? "is-open" : ""}`}>
        <Segmented label="Borough" value={lab.borough || "Manhattan"} className={disabled ? "is-disabled" : ""}
          onChange={(v) => !disabled && setLab({ borough: v })} items={BOROUGHS.map((b) => ({ id: b, label: SHORT[b]! }))} />
        <label className={`lab-range ${disabled ? "is-disabled" : ""}`}>
          <span className="lab-range__label">HOUR <b className="tnum">{howLabel(how)}</b></span>
          <input type="range" min={0} max={23} step={1} value={lab.hour} disabled={disabled} aria-valuetext={howLabel(how)} onChange={(e) => setLab({ hour: Number(e.target.value) })} />
        </label>
        <Segmented label="Day type" value={lab.day} className={disabled ? "is-disabled" : ""} onChange={(v) => !disabled && setLab({ day: v })}
          items={[{ id: "weekday", label: "WKDAY" }, { id: "weekend", label: "WKEND" }]} />
      </div>
      <div className="lab-actions">
        <button type="button" className="btn-square" onClick={reset} disabled={disabled}>{resetDone ? "RESET ✓" : "RESET"}</button>
        <button type="button" className="btn-square lab-more-toggle" aria-expanded={sheet} onClick={() => setSheet((s) => !s)}>{sheet ? "LESS" : "MORE"}</button>
      </div>
    </div>
  );

  return (
    <Track id={id} height={height} landing={landing} label="A city under pressure" className="scene scene-pressure">
      <div className="lab-text">
        <p className="scene-kicker">06 · A CITY UNDER PRESSURE</p>
        <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement" text={statement}
          mode={motion ? { kind: "time", playKey: inLab ? 2 : 1, per: 600, stagger: 60 } : { kind: "value", t: 1 }} />
        {!inLab && (
          <div className="lab-legend" aria-label="Speed as a share of overnight free-flow">
            <p className="mono-label">SPEED / OVERNIGHT FREE-FLOW · {howLabel(how)}</p>
            <div className="lab-legend__row">
              {SPEED_STEPS.map((s, i) => { const c = speedStep([0.95, 0.8, 0.65, 0.5, 0.3][i]!)!; return <span key={s}><i style={{ background: `rgb(${c.join(",")})` }} />{s}</span>; })}
            </div>
            <HonestyChip tag="DERIVED" detail="RATIO OF OBSERVED MEDIANS" />
          </div>
        )}
        <FactsState />
        {fitS.status === "loading" && <LoadingLine file="bpr_fit.json" loaded={fitS.loaded} total={fitS.total} />}
        {fitS.status === "error" && <ErrorLine file="bpr_fit.json" reason={fitS.reason} attempt={fitS.attempt} onRetry={retryFit} />}
        {zhw.status === "loading" && !inLab && <LoadingLine file="zone_hour_week.json" loaded={zhw.loaded} total={zhw.total} />}
      </div>
      {inLab && <div className="lab-ctl-wrap">{controls}</div>}

      {inLab && (
        <section className="lab-stage" aria-label="Pressure lab">
          <div className="lab-stage__head">
            <span className={`chip chip--simulated ${lab.touched ? "chip--pulse" : ""}`}><span className="chip__mark" aria-hidden="true" />SIMULATED<span className="chip__detail"> · {copy?.chip}</span></span>
            <span className="mono-label lab-stage__fit"><HonestyChip tag="DERIVED" detail={`FITTED CURVE · RMSE ${fit ? fit.rmse.toFixed(2) : ""}`} /></span>
          </div>
          <div className="lab-hatch" aria-hidden="true" />
          {fit ? <BprStage fit={fit} dm={lab.dm} cm={lab.cm} how={how} /> : <div className="bpr-stage bpr-stage--skeleton" />}
          {r && (
            <p className="lab-result">
              MEDIAN SPEED <span className="tnum lab-obs">{mph(obsSpeed)}</span> → <span className="tnum lab-sim" data-value={r.simSpeed} data-obs={r.obsSpeed}>{mph(simSpeed)}</span> MPH ·
              A <span className="tnum lab-obs">{Math.round(obsMin)}</span>-MIN TRIP BECOMES <span className="tnum lab-sim">{Math.round(simMin)}</span> MIN
              {r.extrapolated && <span className="lab-warn"> · {copy?.extrapolated}</span>}
            </p>
          )}
          {r === null && fit && <p className="state-line state-line--empty">NO OBSERVED SPEED FOR {lab.borough.toUpperCase()} AT {howLabel(how)}.</p>}
          <p className="sr-only" aria-live="polite" data-testid="lab-live">{live}</p>
          <p className="lab-limit">{copy?.limitation}</p>
        </section>
      )}
    </Track>
  );
}
