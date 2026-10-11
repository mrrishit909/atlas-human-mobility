import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Track } from "../scroll/Track";
import { HonestyChip } from "../components/HonestyChip";
import { Tooltip } from "../components/Tooltip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { ArtifactError } from "./FactsState";
import { useArtifact } from "../data/useArtifact";
import { bprFit, clusters, network, odTop, zoneHourWeek, zonesGeo, type Service } from "../data/types";
import { int } from "../data/copy";
import { howLabel } from "../data/bpr";
import { loadDemandData, model, useAtlas } from "../state/atlas";
import { obs, resetObs, setObs, regionTotal, type ObsLayer } from "../state/obs";
import { labChanged } from "../state/lab";
import { useFrame, useMotion } from "../scroll/hooks";
import { stageH, stageW } from "../graphics/canvas";
import { viewportClass } from "../graphics/ring";
import { lockScroll } from "../scroll/engine";
import { hourBandOf } from "../data/derive";
import { Segmented } from "./S03aRush";
import { Inspector } from "./Inspector";
import { mapState } from "./MapStage";
import { hourValues } from "./mapStyle";

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const SERVICES: { id: Service; label: string }[] = [{ id: "all", label: "ALL" }, { id: "yellow", label: "YELLOW" }, { id: "green", label: "GREEN" }, { id: "fhvhv", label: "APP" }];
const LAYER_TAG: Record<ObsLayer, ["OBSERVED" | "DERIVED", string]> = {
  demand: ["OBSERVED", "MEAN PICKUPS PER HOUR"], speed: ["DERIVED", "SPEED / OVERNIGHT FREE-FLOW"],
  clusters: ["DERIVED", "K-MEANS WEEKLY PROFILES"], network: ["DERIVED", "PAGERANK ON THE 2024 OD GRAPH"],
};
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Horizon time scrubber geometry: 168 positions on an arc (no clock ticks, only 7 day boundaries). */
export function scrubberArc(w: number, h: number) {
  const cls = viewportClass(w);
  const [r, top, x0, x1] = cls === "D" ? [1400, (760 / 900) * h, w * (160 / 1440), w * (1280 / 1440)]
    : cls === "T" ? [900, (900 / 1024) * h, 64, w - 64] : [700, (600 / 844) * h, 24, w - 24];
  const cx = w / 2, cy = top + r;
  const a0 = Math.asin((x0 - cx) / r), a1 = Math.asin((x1 - cx) / r);
  const at = (how: number) => { const a = a0 + ((a1 - a0) * how) / 167; return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) }; };
  const howAt = (x: number) => { const a = Math.asin(Math.max(-1, Math.min(1, (x - cx) / r))); return Math.round(((a - a0) / (a1 - a0)) * 167); };
  return { r, cx, cy, a0, a1, at, howAt };
}

function Scrubber({ w, h }: { w: number; h: number }) {
  const g = scrubberArc(w, h);
  const drag = useRef(false);
  const toHow = (e: React.PointerEvent) => { const rect = (e.currentTarget as SVGElement).getBoundingClientRect(); return Math.max(0, Math.min(167, g.howAt(e.clientX - rect.left))); };
  const p = g.at(obs.how);
  const path = `M${g.at(0).x},${g.at(0).y} A${g.r},${g.r} 0 0 1 ${g.at(167).x},${g.at(167).y}`;
  return (
    <svg className="obs-scrub" width={w} height={h} aria-hidden="false">
      <path d={path} className="obs-scrub__arc" />
      <path d={path} className="obs-scrub__band" onPointerDown={(e) => { drag.current = true; (e.target as Element).setPointerCapture(e.pointerId); setObs({ playing: false, how: toHow(e) }); }}
        onPointerMove={(e) => { if (drag.current) setObs({ how: toHow(e) }); }} onPointerUp={() => (drag.current = false)} />
      {DAYS.map((d, i) => { const q = g.at(i * 24); return <g key={d}><line x1={q.x} x2={q.x} y1={q.y - 6} y2={q.y + 6} className="obs-scrub__tick" /><text x={q.x + 4} y={q.y + 18} className="obs-scrub__day">{d}</text></g>; })}
      <line x1={p.x} x2={p.x} y1={p.y - 44} y2={p.y + 20} className="obs-scrub__tickline" />
      <rect x={p.x - 8} y={p.y - 8} width="16" height="16" fill="#fff" />
      <text x={p.x} y={p.y - 52} className="obs-scrub__readout" textAnchor="middle">{howLabel(obs.how)}</text>
    </svg>
  );
}

/** OBS: The Urban Intelligence Observatory (normal flow, never traps scroll outside EXPLORE). */
export function Observatory({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [zhw, retryZ] = useArtifact(zoneHourWeek);
  const [geo, retryGeo] = useArtifact(zonesGeo, false);
  const [od] = useArtifact(odTop);
  const [net] = useArtifact(network, false); const [cl] = useArtifact(clusters, false); useArtifact(bprFit);
  const [size, setSize] = useState(() => ({ w: stageW(), h: stageH() })); // never a desktop default: on phones it widens the layout viewport
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");
  const [qOpen, setQOpen] = useState(false);
  const [qActive, setQActive] = useState(0);
  const listId = useId();
  const invoker = useRef<HTMLElement | null>(null);
  const sec = useRef<HTMLDivElement>(null);
  const m = model();
  const cls = viewportClass(size.w);

  useEffect(() => {
    const place = () => setSize({ w: stageW(), h: sec.current?.clientHeight ?? innerHeight });
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, []);
  // OBS needs the map data even on a deep link
  useEffect(() => { loadDemandData(); }, []);

  // PLAY: 4 h/s on D (2 on M), wraps 167 -> 0; pauses when hidden, out of view or dragged; RM = hourly steps
  const lastStep = useRef(0);
  useFrame((now) => {
    if (!obs.playing) return;
    const r = sec.current?.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > innerHeight) { setObs({ playing: false }); return; }
    const interval = !motion ? 1000 : cls === "M" ? 500 : 250;
    if (now - lastStep.current >= interval) { lastStep.current = now; setObs({ how: (obs.how + 1) % 168 }); }
  });

  // EXPLORE: the map takes pan/zoom and page scroll locks; Esc or EXIT restores (scrollY unchanged)
  const exitExplore = useCallback(() => { if (!obs.explore) return; lockScroll(false); setObs({ explore: false }); mapState.api?.setController(false); }, []);
  const enterExplore = () => { sec.current?.scrollIntoView({ block: "start" }); lockScroll(true); setObs({ explore: true }); mapState.api?.setController(true); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitExplore(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [exitExplore]);

  const values = useMemo(() => {
    const val = hourValues(obs.how, obs.service);
    return m && val ? m.ids.map((loc) => val(loc)) : null;
  }, [m, zhw.status, obs.how, obs.service]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = values && m ? regionTotal(values, m.ids, m.borough, obs.region) : null;
  const regionName = obs.region?.kind === "borough" ? obs.region.name.toUpperCase() : obs.region?.kind === "zone" && m ? (m.name[m.idx.get(obs.region.loc)!] ?? "").toUpperCase() : "CITYWIDE";
  const serviceName = SERVICES.find((s) => s.id === obs.service)!.label;
  const band = od.status === "ready" ? hourBandOf(obs.how % 24, od.data.bands) : null;
  const futureOk = labChanged();
  const matches = q && m ? m.ids.map((loc, i) => ({ loc, name: m.name[i]! })).filter((z) => z.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const select = (loc: number) => { setObs({ selectedZone: loc, region: { kind: "zone", loc }, scale: "zone" }); setQ(""); setQOpen(false); };
  const hv = mapState.scene === "observatory" ? mapState.hover : { loc: null, x: 0, y: 0 };
  const hvIdx = hv.loc !== null && m ? m.idx.get(hv.loc) : undefined;
  const top20 = values && m ? m.ids.map((loc, i) => ({ loc, i, v: values[i]! })).filter((z) => z.loc && (!obs.region || (obs.region.kind === "borough" ? m.borough[z.i] === obs.region.name : obs.region.loc === z.loc))).sort((a, b) => b.v - a.v).slice(0, 20) : [];

  const rail = (
    <div className={`obs-rail ${sheet ? "is-open" : ""}`} aria-label="Observatory controls">
      <Segmented label="Layer" value={obs.layer} onChange={(v) => setObs({ layer: v })} items={[{ id: "demand", label: "DEMAND" }, { id: "speed", label: "SPEED" }, { id: "clusters", label: "CLUSTERS" }, { id: "network", label: "NETWORK" }]} />
      <Segmented label="Service" value={obs.service} onChange={(v) => setObs({ service: v })} items={SERVICES} />
      <Segmented label="View" value={obs.view3D ? "3d" : "2d"} onChange={(v) => setObs({ view3D: v === "3d" })} items={[{ id: "2d", label: "2D" }, { id: "3d", label: "3D" }]} />
      <Segmented label="Flows" value={obs.flows ? "on" : "off"} onChange={(v) => setObs({ flows: v === "on" })} items={[{ id: "on", label: "FLOWS ON" }, { id: "off", label: "OFF" }]} />
      <div role="radiogroup" aria-label="Compare" className="seg-ctl">
        <button type="button" role="radio" aria-checked={obs.compare === "observed"} className="seg-ctl__item" onClick={() => setObs({ compare: "observed" })}>OBSERVED</button>
        <button type="button" role="radio" aria-checked={obs.compare === "future"} aria-disabled={!futureOk} title={futureOk ? undefined : "SET A SCENARIO IN PRESSURE FIRST"}
          className={`seg-ctl__item ${futureOk ? "" : "is-disabled"}`} onClick={() => futureOk && setObs({ compare: "future", layer: "speed" })}>YOUR FUTURE</button>
      </div>
      <Segmented label="Scale" value={obs.scale} onChange={(v) => setObs({ scale: v })} items={[{ id: "city", label: "CITY" }, { id: "borough", label: "BOROUGH" }, { id: "zone", label: "ZONE" }]} />
      <button type="button" className="btn-square" onClick={() => resetObs()}>RESET VIEW</button>
    </div>
  );

  return (
    <Track id={id} height={height} landing={landing} label="The urban intelligence observatory" className={`scene scene-obs ${obs.explore ? "is-explore" : ""}`}>
      <div className="obs" ref={sec}>
        {!obs.explore && (
          <div className="obs-hit" aria-hidden="true"
            onPointerMove={(e) => mapState.api?.pick(e.clientX, e.clientY)}
            onPointerLeave={() => { mapState.hover = { loc: null, x: 0, y: 0 }; }}
            onClick={(e) => { const loc = mapState.api?.pick(e.clientX, e.clientY); if (loc !== null && loc !== undefined) { invoker.current = e.currentTarget; select(loc); } }} />
        )}
        <div className="obs-title">
          <p className="scene-kicker" style={{ color: "#fff" }}>THE URBAN INTELLIGENCE OBSERVATORY</p>
          <h2 id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement scene-statement--sm">Explore any hour, any zone.</h2>
          <p className="obs-readout tnum" aria-live="polite">
            FILTER: {howLabel(obs.how)} · {serviceName === "ALL" ? "ALL SERVICES" : serviceName} · {regionName} → {total === null ? "…" : int(total)} PICKUPS/HR
          </p>
          <div className="cor-chips">
            {obs.compare === "future" && futureOk && obs.layer === "speed"
              ? <HonestyChip tag="SIMULATED" detail="YOUR FUTURE FROM THE LAB · NOT A FORECAST" />
              // a model chip only over a model that loaded (QA D-052, the D-015 pattern)
              : (obs.layer === "network" && net.status !== "ready") || (obs.layer === "clusters" && cl.status !== "ready") ? null
              : <HonestyChip tag={LAYER_TAG[obs.layer][0]} detail={LAYER_TAG[obs.layer][1]} />}
            {obs.flows && motion && band && <HonestyChip tag="DERIVED" detail={`FLOWS: ALL SERVICES · ${band.label.toUpperCase()} · SEEDED TIMING`} />}
            {!motion && <span className="mono-label">FLOWS SHOWN AS STATIC LINES IN NETWORK VIEW</span>}
          </div>
          <p className="obs-hint mono-label">DRAG THE HORIZON TO MOVE THROUGH THE WEEK. SELECT A ZONE TO INSPECT IT. EXPLORE UNLOCKS PAN AND ZOOM.</p>
          {zhw.status === "loading" && <LoadingLine file="zone_hour_week.json" loaded={zhw.loaded} total={zhw.total} />}
          {zhw.status === "error" && <ErrorLine file="zone_hour_week.json" reason={zhw.reason} attempt={zhw.attempt} onRetry={retryZ} />}
          {geo.status === "loading" && <LoadingLine file="zones.geojson" loaded={geo.loaded} total={geo.total} />}
          {geo.status === "error" && <ErrorLine file="zones.geojson" reason={geo.reason} attempt={geo.attempt} onRetry={retryGeo} />}
          {obs.layer === "network" && <ArtifactError spec={network} />}
          {obs.flows && <ArtifactError spec={odTop} />}
          {obs.layer === "clusters" && <ArtifactError spec={clusters} />}
          {mapState.noGL && <p className="state-line">3D UNAVAILABLE ON THIS DEVICE</p>}
        </div>

        <div className="obs-region">
          <div className="obs-combo">
            <input role="combobox" aria-expanded={qOpen && matches.length > 0} aria-controls={listId} aria-autocomplete="list" aria-label="Search 263 zones"
              aria-activedescendant={qOpen && matches[qActive] ? `${listId}-${matches[qActive]!.loc}` : undefined}
              placeholder="SEARCH 263 ZONES" value={q} onChange={(e) => { setQ(e.target.value); setQOpen(true); setQActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setQActive((a) => Math.min(a + 1, matches.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setQActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter" && matches[qActive]) { invoker.current = e.currentTarget; select(matches[qActive]!.loc); }
                if (e.key === "Escape") setQOpen(false);
              }} />
            {qOpen && matches.length > 0 && (
              <ul id={listId} role="listbox" className="obs-combo__list">
                {matches.map((z, i) => (
                  <li key={z.loc} id={`${listId}-${z.loc}`} role="option" aria-selected={i === qActive} onMouseDown={(e) => { e.preventDefault(); select(z.loc); }}>{z.name.toUpperCase()}</li>
                ))}
              </ul>
            )}
          </div>
          <div role="radiogroup" aria-label="Borough" className="seg-ctl">
            {BOROUGHS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={obs.region?.kind === "borough" && obs.region.name === b} className="seg-ctl__item"
                onClick={() => setObs(obs.region?.kind === "borough" && obs.region.name === b ? { region: null, scale: "city" } : { region: { kind: "borough", name: b }, scale: "borough" })}>
                {b === "Staten Island" ? "SI" : b.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {cls === "M" ? (
          <>
            <button type="button" className="btn-square obs-layers-btn" aria-expanded={sheet} onClick={() => setSheet((s) => !s)}>{sheet ? "CLOSE" : "LAYERS"}</button>
            {sheet && <div className="obs-sheet">{rail}</div>}
          </>
        ) : rail}

        <div className="obs-actions">
          <button type="button" className="btn-square" aria-pressed={obs.playing} onClick={() => setObs({ playing: !obs.playing })}>{obs.playing ? "PAUSE" : "PLAY"}</button>
          {!obs.explore ? <button type="button" className="btn-square" onClick={enterExplore}>EXPLORE</button>
            : <button type="button" className="btn-square obs-exit" onClick={exitExplore}>EXIT ✕</button>}
        </div>

        <div className="obs-scrub-wrap"
          role="slider" tabIndex={0} aria-label="Hour of the week" aria-valuemin={0} aria-valuemax={167} aria-valuenow={obs.how} aria-valuetext={howLabel(obs.how)}
          onKeyDown={(e) => {
            const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 24, PageDown: -24 }[e.key];
            if (d !== undefined) { e.preventDefault(); setObs({ how: (obs.how + d + 168) % 168, playing: false }); }
            if (e.key === "Home") { e.preventDefault(); setObs({ how: 0 }); }
            if (e.key === "End") { e.preventDefault(); setObs({ how: 167 }); }
            if (e.key === " ") { e.preventDefault(); setObs({ playing: !obs.playing }); }
          }}>
          <Scrubber w={size.w} h={size.h} />
        </div>

        <details className="obs-table">
          <summary className="mono-label">DATA TABLE FOR THIS VIEW</summary>
          <table>
            <caption className="sr-only">Top 20 zones by mean pickups per hour at {howLabel(obs.how)}, {serviceName}</caption>
            <thead><tr><th>Zone</th><th>Pickups / hour</th></tr></thead>
            <tbody>{top20.map((z) => <tr key={z.loc}><td>{m!.name[z.i]}</td><td className="tnum">{int(z.v)}</td></tr>)}</tbody>
          </table>
        </details>

        <Inspector returnFocus={() => invoker.current?.focus()} />
        {hvIdx !== undefined && m && values && (
          <Tooltip x={hv.x} y={hv.y} visible>
            {m.name[hvIdx]!.toUpperCase()}<br />{int(values[hvIdx]!)} PICKUPS/HR · {howLabel(obs.how)}<br />{LAYER_TAG[obs.layer][0]}
          </Tooltip>
        )}
      </div>
    </Track>
  );
}
