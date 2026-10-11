import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { stageH, stageW } from "../graphics/canvas";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { Tooltip } from "../components/Tooltip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts, zoneMonth, zonesGeo } from "../data/types";
import { copyS04, int } from "../data/copy";
import { annual, clusterOf, demand, emit, getClusters, loadDemandData, model, useAtlas } from "../state/atlas";
import { getProgress } from "../scroll/engine";
import { useFrame, useMotion, useProgress } from "../scroll/hooks";
import { HANDOFF, morphPositions } from "./director";
import { Segmented } from "./S03aRush";
import { StaticRing } from "./StaticRing";
import { FactsState } from "./FactsState";
import { mapState } from "./MapStage";
import { CLUSTER_CSS, metricValues, type Metric } from "./mapStyle";
import type { MapApi } from "./deckMap";

interface Label { key: string; x: number; y: number; text: string; color?: string; profile?: number[] }

/** max px distance between the Canvas2D handoff positions and deck's own projection (263 zones). */
async function parity() {
  const m = model(), a = mapState.api;
  if (!m || !a || mapState.scene !== "demand") return null; // the map must be serving S04 at the handoff state
  const w = stageW(), h = stageH();
  const pos = morphPositions(HANDOFF, w, h, 0)!;
  let worst = 0;
  for (let i = 0; i < m.n; i++) {
    const q = a.project([m.lon[i]!, m.lat[i]!]);
    if (!q) return null;
    worst = Math.max(worst, Math.hypot(q[0]! - pos.xs[i]!, q[1]! - pos.ys[i]!));
  }
  return { zones: m.n, maxPx: worst };
}

/** S04 Where Demand Concentrates: ring -> map morph (Canvas2D director) -> extruded deck.gl zones (MapStage). */
export function S04Demand({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [geo, retryGeo] = useArtifact(zonesGeo, false);
  const [zm, retryZm] = useArtifact(zoneMonth, false);
  const [labels, setLabels] = useState<{ key: string; list: Label[] }>({ key: "", list: [] });
  const labelsRef = useRef<HTMLDivElement>(null);
  // keep every direct label inside the viewport with a 16px margin; a cut number reads as another number (QA D-004).
  // Labels are placed in rank order; a lower-ranked label that would overprint a placed one moves above it,
  // else below it, else is dropped (QA D-039).
  useLayoutEffect(() => {
    const w = stageW(), h = stageH();
    const placed: DOMRect[] = [];
    const hitAny = (r: DOMRect) => placed.find((q) => r.left < q.right + 4 && q.left < r.right + 4 && r.top < q.bottom + 4 && q.top < r.bottom + 4);
    labelsRef.current?.querySelectorAll<HTMLElement>(".dem-label").forEach((el) => {
      el.style.marginLeft = el.style.marginTop = "0px";
      el.style.display = "";
      let r = el.getBoundingClientRect();
      const shift = r.right > w - 16 ? w - 16 - r.right : r.left < 16 ? 16 - r.left : 0;
      if (shift) el.style.marginLeft = `${Math.round(shift)}px`;
      r = el.getBoundingClientRect();
      for (let k = 0, q = hitAny(r); q && k < 3; k++, q = hitAny(r)) {
        const up = q.top - 6 - r.bottom;
        const dy = r.top + up >= 16 ? up : q.bottom + 6 - r.top;
        el.style.marginTop = `${parseFloat(el.style.marginTop) + dy}px`;
        r = el.getBoundingClientRect();
      }
      if (hitAny(r) || r.top < 16 || r.bottom > h - 16) el.style.display = "none";
      else placed.push(r);
    });
  });

  // direct jumps / deep links to S04 must not depend on S03 having prefetched
  useProgress(id, (p) => { if (p > 0 || !motion) loadDemandData(); });
  useEffect(() => {
    if (!motion) loadDemandData();
    Object.assign((window as unknown as { __atlas: object }).__atlas, { morphParity: parity, mapApi: () => mapState.api });
  }, [motion]);

  const phase = demand.phase;
  const metric = demand.metric as Metric;
  useFrame(() => {
    const a = mapState.api;
    if (!a || mapState.scene !== "demand" || (motion && getProgress(id) < 0.85)) return;
    const w = stageW(), h = stageH();
    const lk = `${phase}:${metric}:${w}x${h}`;
    if (lk !== labels.key) setLabels({ key: lk, list: computeLabels(a, phase, metric, w, h) });
  });

  const copy = f.status === "ready" ? copyS04(f.data) : null;
  const statement = copy ? [copy.s1, copy.s2, copy.s3][phase] ?? copy.s1 : "";
  const m = model();
  const hv = mapState.scene === "demand" ? mapState.hover : { loc: null, x: 0, y: 0 };
  const pick = hv.loc !== null && m ? m.idx.get(hv.loc) : undefined;
  const pu = annual("pickups"), dr = annual("dropoffs");
  const legend = metric === "pickups" ? "HEIGHT = 2024 PICKUPS" : metric === "dropoffs" ? "HEIGHT = 2024 DROPOFFS" : "HEIGHT = |PICKUPS - DROPOFFS|";
  const interactive = !motion || phase >= 1;
  const onMove = (e: React.PointerEvent) => {
    if (!mapState.api || !interactive) return;
    mapState.api.pick(e.clientX, e.clientY);
  };

  return (
    <Track id={id} height={height} landing={landing} label="Where demand concentrates" className="scene scene-demand">
      <div className="dem-text">
        <p className="scene-kicker">05 · WHERE DEMAND CONCENTRATES</p>
        {/* stable heading element: nav jumps and deep links focus it even before the copy loads */}
        <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement" text={statement}
          mode={motion ? { kind: "time", playKey: phase + 1, per: 600, stagger: 60 } : { kind: "value", t: 1 }} />
        <p className="mono-label dem-legend">{legend}</p>
        {phase < 2 && <p className="mono-label dem-legend">LABELS: THE ZONES RANKED 1, 10 AND 50 BY THIS HEIGHT</p>}
        {metric === "net" && <p className="mono-label dem-legend">DIMMED ZONES = NET SINKS (MORE DROPOFFS THAN PICKUPS)</p>}
        <Segmented label="Height metric" value={metric} className={interactive ? "" : "is-disabled"}
          onChange={(v) => { if (interactive) { demand.metric = v; emit(); } }}
          items={[{ id: "pickups", label: "PICKUPS" }, { id: "dropoffs", label: "DROPOFFS" }, { id: "net", label: "NET" }]} />
        <div className="cor-chips">
          <HonestyChip tag="OBSERVED" detail="HEIGHTS" />
          {phase >= 2 && f.status === "ready" && <HonestyChip tag="DERIVED" detail={`K-MEANS, K=${f.data.clusters.k}, SILHOUETTE ${f.data.clusters.silhouette.toFixed(2)}`} />}
        </div>
        {phase >= 2 && copy && <p className="scene-note">{copy.clusterNote}</p>}
        <FactsState />
        {geo.status === "loading" && <LoadingLine file="zones.geojson" loaded={geo.loaded} total={geo.total} />}
        {geo.status === "error" && <ErrorLine file="zones.geojson" reason={geo.reason} attempt={geo.attempt} onRetry={retryGeo} />}
        {zm.status === "error" && <ErrorLine file="zone_month.json" reason={zm.reason} attempt={zm.attempt} onRetry={retryZm} />}
        {mapState.noGL && <p className="state-line">3D UNAVAILABLE ON THIS DEVICE · ZONES SHOWN AS CENTROID SQUARES</p>}
        {!motion && (
          <div role="tablist" aria-label="Map state" className="seg-ctl">
            {["THE MAP", "CONCENTRATION", "CLUSTERS"].map((t, i) => (
              <button key={t} role="tab" aria-selected={phase === i} className="seg-ctl__item" onClick={() => { demand.phase = i; emit(); }}>{t}</button>
            ))}
          </div>
        )}
      </div>
      {!motion && (
        <div className="rm-demand">
          <StaticRing kind="orbit" label="The ring of 263 zones with the 600 busiest corridors" />
          <div className="rm-map" id="rm-demand-map" role="img" aria-label="Extruded map of 2024 pickups by zone" />
        </div>
      )}
      <div className="dem-hit" onPointerMove={onMove} onPointerLeave={() => { mapState.hover = { loc: null, x: 0, y: 0 }; emit(); }} aria-hidden="true" />
      {!motion && labels.list.length > 0 && (
        <ul className="rm-labels mono-label" aria-label="Labelled zones">
          {labels.list.map((l) => <li key={l.key} style={{ color: l.color }}>{l.text}</li>)}
        </ul>
      )}
      <div className="dem-labels" aria-hidden="true" ref={labelsRef}>
        {motion && phase >= 1 && labels.list.map((l) => (
          <span key={l.key} className="dem-label" style={{ left: l.x, top: l.y, color: l.color }}>
            {l.text}
            {l.profile && <Spark values={l.profile} color={l.color ?? "#fff"} />}
          </span>
        ))}
      </div>
      {pick !== undefined && m && pu && dr && (
        <Tooltip x={hv.x} y={hv.y} visible>
          {m.name[pick]!.toUpperCase()} · {m.borough[pick]!.toUpperCase()}<br />
          {int(pu[pick]!)} PICKUPS · {int(dr[pick]!)} DROPOFFS, 2024<br />OBSERVED
        </Tooltip>
      )}
      <ol className="sr-only" aria-label="Top 10 zones by 2024 pickups">
        {m && pu && Array.from(pu.keys()).sort((x, y) => pu[y]! - pu[x]!).slice(0, 10).map((i) => <li key={i}>{m.name[i]}: {int(pu[i]!)} pickups</li>)}
      </ol>
    </Track>
  );
}

function computeLabels(a: MapApi, phase: number, metric: Metric, w: number, h: number): Label[] {
  const m = model(), vals = metricValues(metric), cl = clusterOf(), cs = getClusters();
  if (!m || !vals) return [];
  const vp = a.viewport(w, h);
  let max = 0;
  for (const v of vals) max = Math.max(max, Math.abs(v));
  const order = Array.from(vals.keys()).sort((x, y) => Math.abs(vals[y]!) - Math.abs(vals[x]!));
  const z = (i: number) => (Math.abs(vals[i]!) / Math.max(1, max)) * 6000;
  const at = (i: number) => { const [x, y] = vp.project([m.lon[i]!, m.lat[i]!, z(i)]); return { x: x!, y: y! }; };
  if (phase >= 2 && cl && cs) {
    // each cluster labelled on its largest member zone, with its weekly profile
    return cs.clusters.map((c): Label | null => {
      let best = -1;
      for (const i of order) if (cl[i] === c.id) { best = i; break; }
      if (best < 0) return null;
      return { key: `c${c.id}`, ...at(best), text: c.label.toUpperCase(), color: CLUSTER_CSS[c.id % 3], profile: c.centroid };
    }).filter((x): x is Label => x !== null);
  }
  // three reference heights labelled directly on real zones (ranks 1, 10, 50)
  return [0, 9, 49].map((rank) => {
    const i = order[rank]!;
    return { key: `r${rank}`, ...at(i), text: `${m.name[i]!.toUpperCase()} · ${int(Math.abs(vals[i]!))}` };
  });
}

export function Spark({ values, color, w = 64, h = 16, marker }: { values: number[]; color: string; w?: number; h?: number; marker?: number }) {
  const max = Math.max(...values), min = Math.min(...values);
  const X = (i: number) => (i / (values.length - 1)) * w, Y = (v: number) => h - 1 - ((v - min) / Math.max(1e-9, max - min)) * (h - 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1" />
      {marker !== undefined && values[marker] !== undefined && <rect x={X(marker) - 3} y={Y(values[marker]!) - 3} width="6" height="6" fill="#fff" />}
    </svg>
  );
}
