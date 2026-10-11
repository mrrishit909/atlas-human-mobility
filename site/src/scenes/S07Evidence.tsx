import { useLayoutEffect, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { bprFit, clusters, daily, facts, meta, weatherModel, type Daily } from "../data/types";
import { copyS07, int, limitations, signed, type Exchange } from "../data/copy";
import { useMotion, useProgress } from "../scroll/hooks";
import { stepState } from "../motion/progress";
import { FactsState } from "./FactsState";
import type { LoadState } from "../data/loader";

export const REPO = "https://github.com/mrrishit909/atlas-human-mobility";
const N = 7;
export const EVIDENCE_THRESHOLDS = Array.from({ length: N - 1 }, (_, i) => (i + 1) / N);

/** Daily rides vs rain (raw totals) with the model's partial slope through the dry-day median. */
function RainScatter({ d, pct }: { d: Daily; pct: number }) {
  const W = 420, H = 150, L = 4, B = 18;
  const tot = d.date.map((_, i) => Object.values(d.trips).reduce((s, arr) => s + (arr[i] ?? 0), 0));
  const pr = d.prcp_mm.map((v) => v ?? 0);
  const xmax = Math.max(...pr, 10), ymin = Math.min(...tot), ymax = Math.max(...tot);
  const X = (x: number) => L + (x / xmax) * (W - L * 2), Y = (y: number) => H - B - ((y - ymin) / (ymax - ymin)) * (H - B - 6);
  const dry = tot.filter((_, i) => pr[i] === 0).sort((a, b) => a - b);
  const med = dry[Math.floor(dry.length / 2)] ?? tot[0]!;
  const slope = (x: number) => med * Math.pow(1 + pct / 100, x / 10);
  return (
    <figure className="ev-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${d.date.length} days of 2024: daily rides against rain in millimetres, with the model slope of ${signed(pct)}% per 10 mm`}>
        {pr.map((x, i) => <rect key={i} x={X(x) - 1} y={Y(tot[i]!) - 1} width="2" height="2" fill="#000" opacity={0.65} />)}
        <line x1={X(0)} y1={Y(slope(0))} x2={X(xmax)} y2={Y(slope(xmax))} stroke="#000" strokeWidth="1.5" />
        <text x={L} y={H - 4} className="ev-axis">0 MM</text>
        <text x={W - L} y={H - 4} className="ev-axis" textAnchor="end">{Math.round(xmax)} MM RAIN</text>
      </svg>
      <figcaption className="ev-cap">{d.date.length} DAYS, RAW TOTALS. THE LINE IS THE MODEL SLOPE THROUGH THE DRY-DAY MEDIAN; THE ESTIMATE HOLDS WEEKDAY, MONTH, TEMPERATURE, SNOW AND HOLIDAYS FIXED.</figcaption>
    </figure>
  );
}

function LedgerBar({ kept, excluded }: { kept: number; excluded: number }) {
  return (
    <figure className="ev-fig">
      <div className="ev-ledger" aria-hidden="true"><i style={{ flexGrow: kept }} /><b style={{ flexGrow: Math.max(excluded, (kept + excluded) * 0.004) }} /></div>
      <figcaption className="ev-cap">KEPT {int(kept)} · EXCLUDED {int(excluded)} (THE DARK SLIVER, DRAWN AT LEAST 0.4% WIDE TO STAY VISIBLE)</figcaption>
    </figure>
  );
}

function BprBars({ bpr }: { bpr: Record<string, { holdout?: { borough_level?: { test: { rmse: number; rmse_const_train_mean: number; rmse_freeflow_const: number } } } }> }) {
  const rows = Object.entries(bpr).flatMap(([b, v]) => (v.holdout?.borough_level ? [{ b, t: v.holdout.borough_level.test }] : []));
  const max = Math.max(...rows.map((r) => r.t.rmse_freeflow_const), 0.01);
  return (
    <figure className="ev-fig">
      <table className="ev-bpr">
        <caption className="ev-cap">HOLDOUT ERROR (OCT-DEC), LOWER IS BETTER: CURVE / CONSTANT / ALWAYS FREE-FLOW</caption>
        <tbody>
          {rows.map(({ b, t }) => (
            <tr key={b}>
              <th scope="row">{b.toUpperCase()}</th>
              <td>
                <span className="ev-bar ev-bar--fit" style={{ width: `${(t.rmse / max) * 100}%` }} />
                <span className="ev-bar ev-bar--const" style={{ width: `${(t.rmse_const_train_mean / max) * 100}%` }} />
                <span className="ev-bar ev-bar--ff" style={{ width: `${(t.rmse_freeflow_const / max) * 100}%` }} />
              </td>
              <td className="tnum">{t.rmse.toFixed(2)} / {t.rmse_const_train_mean.toFixed(2)} / {t.rmse_freeflow_const.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function visual(i: number, ex: Exchange, ctx: { daily: LoadState<Daily>; retryDaily: () => void; f: { trips_kept_total: number; excluded_total: number; weather_prcp_effect_10mm: { pct: number } } | null; bpr: Parameters<typeof BprBars>[0]["bpr"] | null }) {
  if (i === 1 && ctx.f) return <LedgerBar kept={ctx.f.trips_kept_total} excluded={ctx.f.excluded_total} />;
  if (i === 3 && ctx.f) {
    if (ctx.daily.status === "ready") return <RainScatter d={ctx.daily.data} pct={ctx.f.weather_prcp_effect_10mm.pct} />;
    if (ctx.daily.status === "error") return <div className="ev-src"><p className="state-line">SOURCE UNAVAILABLE</p><ErrorLine file="daily.json" reason={ctx.daily.reason} attempt={ctx.daily.attempt} onRetry={ctx.retryDaily} /></div>;
    if (ctx.daily.status === "loading") return <LoadingLine file="daily.json" loaded={ctx.daily.loaded} total={ctx.daily.total} />;
  }
  if (i === 4 && ctx.bpr) return <BprBars bpr={ctx.bpr} />;
  void ex;
  return null;
}

/** S07 Evidence: the argument stack (objection, then the pipeline's answer), stepped per exchange. */
export function S07Evidence({ id, height, landing }: { id: string; height: string; landing: number }) {
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [m] = useArtifact(meta);
  const [bpr, retryBpr] = useArtifact(bprFit);
  const [cl, retryCl] = useArtifact(clusters);
  const [wm, retryWm] = useArtifact(weatherModel);
  const [d, retryD] = useArtifact(daily);
  const [step, setStep] = useState(0);
  // the typing indicator exists only for the 350ms between cards (a transition, not a fake load)
  const [typing, setTyping] = useState(false);
  const stepRef = useRef(0);
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>([]);

  useProgress(id, (p) => {
    const s = stepState(stepRef.current, p, EVIDENCE_THRESHOLDS);
    if (s !== stepRef.current) { stepRef.current = s; setStep(s); setTyping(true); }
  });
  // measured each render; the equality guard stops the update loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const hs = blocks.current.map((b) => b?.offsetHeight ?? 0);
    if (hs.join() !== heights.join()) setHeights(hs);
  });

  const ready = f.status === "ready" && bpr.status === "ready" && cl.status === "ready";
  const exchanges = ready ? copyS07(f.data, { bpr: bpr.data.boroughs, clusters: cl.data as never }) : [];
  const errs = [
    bpr.status === "error" && <ErrorLine key="b" file="bpr_fit.json" reason={bpr.reason} attempt={bpr.attempt} onRetry={retryBpr} />,
    cl.status === "error" && <ErrorLine key="c" file="clusters.json" reason={cl.reason} attempt={cl.attempt} onRetry={retryCl} />,
    wm.status === "error" && <ErrorLine key="w" file="weather_model.json" reason={wm.reason} attempt={wm.attempt} onRetry={retryWm} />,
  ].filter(Boolean);
  const gen = m.status === "ready" ? m.data.generated_at : "";
  const ver = m.status === "ready" ? m.data.pipeline_version : "";
  const cur = exchanges[Math.min(step, exchanges.length - 1)];

  // offsets: the newest exchange sits at the bottom; older ones stack upward, dim and recede
  const offsetOf = (j: number) => {
    let y = 0;
    for (let k = j + 1; k <= step; k++) y += (heights[k] ?? 0) + 16;
    return y;
  };

  return (
    <Track id={id} height={height} landing={landing} label="How we know" className="scene scene-evidence">
      <div className="ev-head">
        <p className="scene-kicker">08 · HOW WE KNOW</p>
        <h2 id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement scene-statement--sm">How we know.</h2>
        <FactsState />
        {errs}
      </div>
      <div className={`ev-stack ${motion ? "" : "is-flow"}`} aria-live="polite">
        {exchanges.map((ex, j) => {
          const age = step - j;
          const shown = !motion || age >= 0;
          // older exchanges recede by scale and a muted palette (not opacity), so they stay AA-readable
          const style = !motion ? undefined : {
            transform: age < 0 ? "translateY(40px)" : `translateY(${-offsetOf(j)}px) scale(${age >= 1 ? 0.96 : 1})`,
            opacity: age < 0 || age >= 2 ? 0 : 1,
          };
          return (
            <div key={j} className={`ev-ex ${age >= 2 ? "is-old" : ""} ${motion && age === 1 ? "is-prev" : ""}`} ref={(el) => { blocks.current[j] = el; }} style={style} aria-hidden={!shown || (motion && age >= 2)}>
              <article className="ev-card ev-card--q">
                <header className="note__head"><span>A SKEPTIC</span><span>NOW</span></header>
                <p className="ev-q">{ex.q}</p>
              </article>
              <article className="ev-card ev-card--a" style={motion ? { transitionDelay: age === 0 ? "350ms" : "0ms" } : undefined}>
                <header className="note__head"><span>THE PIPELINE</span><span>ALWAYS</span></header>
                <p className="ev-a">{ex.a}</p>
                {visual(j, ex, { daily: d, retryDaily: retryD, f: f.status === "ready" ? f.data : null, bpr: bpr.status === "ready" ? bpr.data.boroughs : null })}
                {ex.tag && <HonestyChip tag={ex.tag} onLight detail={j === 3 ? "ASSOCIATION, NOT CAUSE" : undefined} />}
              </article>
            </div>
          );
        })}
        {motion && typing && <p className="ev-typing" aria-hidden="true" key={`t${step}`} onAnimationEnd={() => setTyping(false)}>THE PIPELINE IS TYPING<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>}
      </div>
      <aside className="ev-receipt" aria-label="Source for this answer">
        <p className="mono-label">RECEIPT</p>
        {cur && (
          <p className="ev-receipt__row">
            <a href={`${REPO}/blob/main/site/public/data/${cur.receipt}`} target="_blank" rel="noopener">{cur.receipt.toUpperCase()}</a><br />
            SCHEMA v1 · PIPELINE v{ver}<br />GENERATED {gen.slice(0, 10)}
          </p>
        )}
        <p className="mono-label ev-limits-head">LIMITATIONS</p>
        <ul className="ev-limits">{limitations().map((l) => <li key={l}>{l}</li>)}</ul>
      </aside>
    </Track>
  );
}
