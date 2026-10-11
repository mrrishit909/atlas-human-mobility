import { useEffect, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { Tooltip } from "../components/Tooltip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { clusters as clustersSpec, facts, zoneMonth, zonesGeo } from "../data/types";
import { copyS04, int } from "../data/copy";
import { annual, clusterOf, demand, emit, getClusters, getGeo, halfPickups, loadDemandData, model, useAtlas } from "../state/atlas";
import { locate } from "../scroll/engine";
import { useFrame, useMotion, useProgress } from "../scroll/hooks";
import { stepState, windowed } from "../motion/progress";
import { easeSymmetric } from "../motion/ease";
import { lerp } from "../lib/math";
import { viewportClass } from "../graphics/ring";
import { HANDOFF, handoff, morphPositions, RING_SCENES } from "./director";
import { mapView, type MapViewState } from "./mapView";
import { Segmented } from "./S03aRush";
import { StaticRing } from "./StaticRing";
import type { MapApi, MapStyle } from "./deckMap";

const SCENES = [...RING_SCENES, "pressure"] as const;
const PHASES = [0.85, 0.92] as const;
const CLUSTER_RGB: [number, number, number][] = [[255, 255, 255], [88, 184, 225], [143, 162, 255]];
const CLUSTER_CSS = ["#ffffff", "#58b8e1", "#8fa2ff"];
const SURFACE: [number, number, number] = [22, 22, 22];
type Metric = "pickups" | "dropoffs" | "net";

function metricValues(metric: Metric) {
  const pu = annual("pickups"), dr = annual("dropoffs");
  if (!pu || !dr) return null;
  if (metric === "pickups") return pu;
  if (metric === "dropoffs") return dr;
  return Float64Array.from(pu, (v, i) => v - dr[i]!);
}

function styleFor(phase: number, metric: Metric, p: number): MapStyle | null {
  const m = model(), vals = metricValues(metric), half = halfPickups(), cl = clusterOf();
  if (!m || !vals || !half) return null;
  let max = 0;
  for (const v of vals) max = Math.max(max, Math.abs(v));
  const ri = (loc: number) => m.idx.get(loc) ?? -1;
  return {
    key: `${phase}:${metric}`,
    max,
    value: (loc) => vals[ri(loc)] ?? 0,
    polygonOpacity: windowed(p, HANDOFF, HANDOFF + 0.05),
    elevationScale: easeSymmetric(windowed(p, HANDOFF, 0.85)),
    fill: (loc) => {
      const i = ri(loc);
      const v = vals[i] ?? 0;
      if (phase >= 2 && cl) {
        const c = cl[i] ?? -1;
        return c >= 0 ? [...CLUSTER_RGB[c % 3]!, 235] : [41, 41, 41, 200];
      }
      if (metric === "net" && v < 0) return [22, 22, 22, 60]; // sinks: hollow-reading, drawn up to |value|
      const t = Math.pow(Math.abs(v) / Math.max(1, max), 0.35);
      const rgb = SURFACE.map((s, k) => Math.round(lerp(s, [88, 184, 225][k]!, Math.min(1, 0.3 + 0.7 * t)))) as [number, number, number];
      const dim = phase >= 1 && !half.has(i);
      return [...rgb, dim ? 64 : 255];
    },
  };
}

function cameraAt(base: MapViewState, p: number, cls: string): MapViewState {
  const s = easeSymmetric(windowed(p, HANDOFF, 0.85));
  return { ...base, pitch: (cls === "M" ? 40 : 50) * s, bearing: -18 * s };
}

interface Label { key: string; x: number; y: number; text: string; color?: string; profile?: number[] }

/** S04 Where Demand Concentrates: ring -> map morph (Canvas2D) -> extruded deck.gl zones. */
export function S04Demand({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [geo, retryGeo] = useArtifact(zonesGeo, false);
  const [zm, retryZm] = useArtifact(zoneMonth, false);
  const [cl] = useArtifact(clustersSpec, false);
  const fixedRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const api = useRef<MapApi | null>(null);
  const [noGL, setNoGL] = useState(false);
  const [phase, setPhase] = useState(0);
  const [metric, setMetric] = useState<Metric>("pickups");
  const [tip, setTip] = useState<{ x: number; y: number; loc: number | null }>({ x: 0, y: 0, loc: null });
  const [labels, setLabels] = useState<{ key: string; list: Label[] }>({ key: "", list: [] });
  const [rmPhase, setRmPhase] = useState(1);
  const phaseRef = useRef(0);
  const lastKey = useRef("");

  // direct jumps / deep links to S04 must not depend on S03 having prefetched
  useProgress(id, (p) => { if (p > 0 || !motion) loadDemandData(); });
  useEffect(() => { if (!motion) loadDemandData(); }, [motion]);

  // create the map once geometry is in and the stage is warm (S03 prefetches the data)
  const geoData = getGeo();
  useEffect(() => {
    const parent = motion ? fixedRef.current : flowRef.current;
    if (!geoData || !parent || api.current) return;
    let cancelled = false;
    import("./deckMap").then(({ createMap, webglAvailable }) => {
      if (cancelled) return;
      if (!webglAvailable()) { setNoGL(true); return; }
      api.current = createMap(parent, geoData, (loc, x, y) => setTip({ x, y, loc }));
      handoff.deckReady = true;
      lastKey.current = "";
      Object.assign((window as unknown as { __atlas: object }).__atlas, { morphParity: () => parity(api.current), mapApi: () => api.current });
    });
    return () => {
      cancelled = true;
      api.current?.destroy();
      api.current = null;
      handoff.deckReady = false;
    };
  }, [geoData, motion]);

  useFrame((now) => {
    const a = api.current;
    const m = model();
    if (!a || !m) return;
    const w = innerWidth, h = innerHeight, cls = viewportClass(w);
    let p: number, ph: number;
    if (motion) {
      const loc = locate(SCENES);
      const here = loc?.id === "demand";
      const fade = Math.min(1, (now - handoff.at) / 200);
      if (fixedRef.current) fixedRef.current.style.opacity = here ? String(handoff.on ? fade : 1 - fade) : "0";
      if (!here) return;
      p = loc!.p;
      ph = stepState(phaseRef.current, p, PHASES);
    } else {
      p = 1;
      ph = rmPhase;
    }
    if (ph !== phaseRef.current) { phaseRef.current = ph; setPhase(ph); }
    const key = `${p.toFixed(4)}:${ph}:${metric}:${w}x${h}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const box = motion ? { w, h } : { w: flowRef.current?.clientWidth ?? w, h: flowRef.current?.clientHeight ?? h };
    const st = styleFor(ph, metric, p);
    if (!st) return;
    a.update(cameraAt(mapView(m, box.w, box.h, cls), p, cls), st);
    // direct labels once the camera has landed
    if (p >= 0.85) {
      const lk = `${ph}:${metric}:${box.w}x${box.h}`;
      if (lk !== labels.key) setLabels({ key: lk, list: computeLabels(a, ph, metric, box.w, box.h) });
    }
  });

  const onMove = (e: React.PointerEvent) => {
    if (!api.current || phaseRef.current < 1 && motion) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    api.current.pick(e.clientX - r.left, e.clientY - r.top);
    setTip((t) => ({ ...t, x: e.clientX, y: e.clientY }));
  };

  const copy = f.status === "ready" ? copyS04(f.data) : null;
  const statement = copy ? [copy.s1, copy.s2, copy.s3][motion ? phase : rmPhase] ?? copy.s1 : "";
  const m = model();
  const pick = tip.loc !== null && m ? m.idx.get(tip.loc) : undefined;
  const pu = annual("pickups"), dr = annual("dropoffs");
  const legend = metric === "pickups" ? "HEIGHT = 2024 PICKUPS" : metric === "dropoffs" ? "HEIGHT = 2024 DROPOFFS" : "HEIGHT = PICKUPS - DROPOFFS (SINKS DIM)";
  const interactive = !motion || phase >= 1;

  return (
    <Track id={id} height={height} landing={landing} label="Where demand concentrates" className="scene scene-demand">
      {motion && <div className="deck-stage" ref={fixedRef} aria-hidden="true" />}
      <div className="dem-text">
        <p className="scene-kicker">05 · WHERE DEMAND CONCENTRATES</p>
        {/* stable heading element: nav jumps and deep links focus it even before the copy loads */}
        {<WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement" text={statement}
          mode={motion ? { kind: "time", playKey: phase + 1, per: 600, stagger: 60 } : { kind: "value", t: 1 }} />}
        <p className="mono-label dem-legend">{legend}</p>
        <Segmented label="Height metric" value={metric} className={interactive ? "" : "is-disabled"}
          onChange={(v) => { if (interactive) { setMetric(v); demand.metric = v; emit(); } }}
          items={[{ id: "pickups", label: "PICKUPS" }, { id: "dropoffs", label: "DROPOFFS" }, { id: "net", label: "NET" }]} />
        <div className="cor-chips">
          <HonestyChip tag="OBSERVED" detail="HEIGHTS" />
          {(motion ? phase : rmPhase) >= 2 && copy && <HonestyChip tag="DERIVED" detail={`K-MEANS, K=${f.status === "ready" ? f.data.clusters.k : ""}, SILHOUETTE ${f.status === "ready" ? f.data.clusters.silhouette.toFixed(2) : ""}`} />}
        </div>
        {(motion ? phase : rmPhase) >= 2 && copy && <p className="scene-note">{copy.clusterNote}</p>}
        {geo.status === "loading" && <LoadingLine file="zones.geojson" loaded={geo.loaded} total={geo.total} />}
        {geo.status === "error" && <ErrorLine file="zones.geojson" reason={geo.reason} attempt={geo.attempt} onRetry={retryGeo} />}
        {zm.status === "error" && <ErrorLine file="zone_month.json" reason={zm.reason} attempt={zm.attempt} onRetry={retryZm} />}
        {noGL && <p className="state-line">3D UNAVAILABLE ON THIS DEVICE · ZONES SHOWN AS CENTROID SQUARES</p>}
        {!motion && (
          <div role="tablist" aria-label="Map state" className="seg-ctl">
            {["THE MAP", "CONCENTRATION", "CLUSTERS"].map((t, i) => (
              <button key={t} role="tab" aria-selected={rmPhase === i} className="seg-ctl__item" onClick={() => setRmPhase(i)}>{t}</button>
            ))}
          </div>
        )}
      </div>
      {!motion && (
        <div className="rm-demand">
          <StaticRing kind="orbit" label="The ring of 263 zones with the 600 busiest corridors" />
          <div className="rm-map" ref={flowRef} />
        </div>
      )}
      <div className="dem-hit" onPointerMove={onMove} onPointerLeave={() => setTip((t) => ({ ...t, loc: null }))} aria-hidden="true" />
      <div className="dem-labels" aria-hidden="true">
        {(motion ? phase >= 1 : true) && labels.list.map((l) => (
          <span key={l.key} className="dem-label" style={{ left: l.x, top: l.y, color: l.color }}>
            {l.text}
            {l.profile && <Spark values={l.profile} color={l.color ?? "#fff"} />}
          </span>
        ))}
      </div>
      {pick !== undefined && m && pu && dr && (
        <Tooltip x={tip.x} y={tip.y} visible>
          {m.name[pick]!.toUpperCase()} · {m.borough[pick]!.toUpperCase()}<br />
          {int(pu[pick]!)} PICKUPS · {int(dr[pick]!)} DROPOFFS, 2024<br />OBSERVED
        </Tooltip>
      )}
      <ol className="sr-only" aria-label="Top 10 zones by 2024 pickups">
        {m && pu && Array.from(pu.keys()).sort((x, y) => pu[y]! - pu[x]!).slice(0, 10).map((i) => <li key={i}>{m.name[i]}: {int(pu[i]!)} pickups</li>)}
      </ol>
      {cl.status === "error" && null}
    </Track>
  );
}

/** max px distance between the Canvas2D handoff positions and deck's own projection (263 zones). */
async function parity(a: MapApi | null) {
  const m = model();
  if (!m || !a) return null;
  const w = innerWidth, h = innerHeight;
  const pos = morphPositions(HANDOFF, w, h, 0)!;
  let worst = 0;
  for (let i = 0; i < m.n; i++) {
    const q = a.project([m.lon[i]!, m.lat[i]!]);
    if (!q) return null;
    worst = Math.max(worst, Math.hypot(q[0]! - pos.xs[i]!, q[1]! - pos.ys[i]!));
  }
  return { zones: m.n, maxPx: worst };
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
      const p = at(best);
      return { key: `c${c.id}`, ...p, text: c.label.toUpperCase(), color: CLUSTER_CSS[c.id % 3], profile: c.centroid };
    }).filter((x): x is Label => x !== null);
  }
  // three reference heights labelled directly on real zones (ranks 1, 10, 50)
  return [0, 9, 49].map((rank) => {
    const i = order[rank]!;
    const p = at(i);
    return { key: `r${rank}`, ...p, text: `${m.name[i]!.toUpperCase()} · ${int(Math.abs(vals[i]!))}` };
  });
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values), min = Math.min(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * 64).toFixed(1)},${(16 - ((v - min) / Math.max(1e-9, max - min)) * 15).toFixed(1)}`).join("");
  return <svg className="spark" width="64" height="16" viewBox="0 0 64 16" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="1" /></svg>;
}
