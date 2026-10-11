/**
 * The map stage: ONE deck.gl instance for S04, S05, OBS and S08, in a fixed
 * layer under the scene content. A per-scene "map frame" (like the ring
 * director) decides camera, style and opacity from scroll progress / stores.
 * OBS is a normal-flow section, so the fixed map is clipped to its rect.
 * deck's render loop is stopped whenever no map scene is on screen.
 */
import { useEffect, useRef } from "react";
import { stageH, stageW } from "../graphics/canvas";
import { viewportClass } from "../graphics/ring";
import { lerp, clamp } from "../lib/math";
import { easeSmooth, easeSymmetric } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { locate } from "../scroll/engine";
import { useFrame } from "../scroll/hooks";
import { motionEnabled } from "../state/motion";
import { demand, emit, getGeo, getNetwork, getOdTop, clusterOf, model, annual, useAtlas } from "../state/atlas";
import { lab, labHow, labChanged } from "../state/lab";
import { obs, inRegion } from "../state/obs";
import { HANDOFF, handoff } from "./director";
import { mapView, type MapViewState } from "./mapView";
import { CLUSTER_RGB, EDGE, demandStyle, hourValues, quantileRamp, speedRatioAt, speedStep, type Metric } from "./mapStyle";
import type { MapApi, MapStyle } from "./deckMap";
import { getStore } from "../data/loader";
import { bprFit } from "../data/types";
import { labResult } from "../data/bpr";
import { bandRows, hourBandOf } from "../data/derive";
import type { WebMercatorViewport } from "@math.gl/web-mercator";

export const SCENE_ORDER = ["city", "anatomy", "rush-hour", "corridors", "demand", "pressure", "futures", "evidence", "observatory", "closing"] as const;
const PHASES = [0.85, 0.92] as const;

export const mapState = {
  api: null as MapApi | null,
  noGL: false,
  hover: { loc: null as number | null, x: 0, y: 0 },
  /** which scene the map is serving this frame */
  scene: "" as string,
};
const setHover = (loc: number | null, x: number, y: number) => {
  if (loc === mapState.hover.loc && Math.abs(x - mapState.hover.x) < 1 && Math.abs(y - mapState.hover.y) < 1) return;
  mapState.hover = { loc, x, y };
  emit();
};

// ---- camera tween (OBS scale / region / 2D-3D) ----
const cam = { from: null as MapViewState | null, to: null as MapViewState | null, start: 0, key: "", dur: 1200 };
function tweenView(target: MapViewState, key: string, now: number, dur = 1200): MapViewState {
  if (!cam.to) { cam.to = cam.from = target; cam.key = key; }
  if (key !== cam.key) {
    cam.from = currentView(now);
    cam.to = target;
    cam.start = now;
    cam.key = key;
    cam.dur = motionEnabled() ? dur : 0;
  }
  cam.to = target;
  return currentView(now);
}
function currentView(now: number): MapViewState {
  const e = cam.dur > 0 ? easeSmooth(clamp((now - cam.start) / cam.dur)) : 1;
  const a = cam.from!, b = cam.to!;
  return { longitude: lerp(a.longitude, b.longitude, e), latitude: lerp(a.latitude, b.latitude, e), zoom: lerp(a.zoom, b.zoom, e), pitch: lerp(a.pitch, b.pitch, e), bearing: lerp(a.bearing, b.bearing, e) };
}
export const cameraMoving = (now: number) => cam.dur > 0 && now - cam.start < cam.dur;

/** Fit the camera to a set of ring indices (OBS SCALE BOROUGH / ZONE). */
function fitTo(idx: number[], cls: string, vp: WebMercatorViewport | null, pitch: number): MapViewState | null {
  const m = model();
  if (!m || !idx.length || !vp) return null;
  let a = 180, b = -180, c = 90, d = -90;
  for (const i of idx) { a = Math.min(a, m.lon[i]!); b = Math.max(b, m.lon[i]!); c = Math.min(c, m.lat[i]!); d = Math.max(d, m.lat[i]!); }
  const pad = 0.01;
  const pv = vp.fitBounds([[a - pad, c - pad], [b + pad, d + pad]], { padding: cls === "M" ? { top: 120, bottom: 240, left: 16, right: 16 } : { top: 140, bottom: 220, left: cls === "D" ? 420 : 48, right: cls === "D" ? 300 : 48 } });
  return { longitude: pv.longitude, latitude: pv.latitude, zoom: Math.min(pv.zoom, 13.5), pitch, bearing: -18 };
}

// ---- frames ----
interface MapFrame { view: MapViewState; style: MapStyle; opacity: number; clip?: [number, number]; live?: boolean }

function demandFrame(p: number, w: number, h: number, now: number): MapFrame | null {
  const m = model();
  if (!m) return null;
  const cls = viewportClass(w);
  const ph = motionEnabled() ? stepState(demand.phase, p, PHASES) : demand.phase;
  if (ph !== demand.phase) { demand.phase = ph; demand.phaseAt = now; emit(); }
  const s = easeSymmetric(windowed(p, HANDOFF, 0.85));
  const base = mapView(m, w, h, cls);
  const view = { ...base, pitch: (cls === "M" ? 40 : 50) * s, bearing: -18 * s };
  const style = demandStyle(ph, demand.metric as Metric, windowed(p, HANDOFF, HANDOFF + 0.05), s);
  if (!style) return null;
  const fade = Math.min(1, (now - handoff.at) / 200);
  return { view, style, opacity: handoff.on ? fade : 1 - fade, live: fade < 1 };
}

function rmDemandFrame(w: number, h: number, box: DOMRect): MapFrame | null {
  const m = model();
  if (!m) return null;
  const pad = { left: box.left + 16, right: w - box.right + 16, top: Math.max(0, box.top) + 16, bottom: Math.max(0, h - box.bottom) + 16 };
  if (box.height < 120) return null;
  let a = 180, b = -180, c = 90, d = -90;
  for (let i = 0; i < m.n; i++) { a = Math.min(a, m.lon[i]!); b = Math.max(b, m.lon[i]!); c = Math.min(c, m.lat[i]!); d = Math.max(d, m.lat[i]!); }
  const vp = mapState.api!.viewport(w, h).fitBounds([[a, c], [b, d]], { padding: pad });
  const style = demandStyle(demand.phase, demand.metric as Metric, 1, 1);
  if (!style) return null;
  return { view: { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 45, bearing: -18 }, style, opacity: 1, clip: [Math.max(0, box.top), Math.max(0, h - box.bottom)] };
}

/** S05: observed pressure on the map (p 0-0.35), then the dim background of the lab. */
function pressureFrame(p: number, w: number, h: number): MapFrame | null {
  const m = model(), pu = annual("pickups");
  const ratio = speedRatioAt(labHow());
  if (!m || !pu || !ratio) return null;
  const cls = viewportClass(w);
  const base = mapView(m, w, h, cls);
  const s = easeSymmetric(windowed(p, 0, 0.12));
  const view = { ...base, zoom: base.zoom - 0.6 * s, pitch: lerp(cls === "M" ? 40 : 50, 35, s), bearing: -18 };
  let max = 0;
  for (const v of pu) max = Math.max(max, v);
  const ri = (loc: number) => m.idx.get(loc) ?? -1;
  const style: MapStyle = {
    key: `p:${labHow()}`, max, edge: EDGE, polygonOpacity: 1, elevationScale: 1,
    value: (loc) => pu[ri(loc)] ?? 0,
    fill: (loc) => { const c = speedStep(ratio(loc)); return c ? [...c, 255] : [41, 41, 41, 200]; },
  };
  // observed pressure readable at 60%; the lab keeps the map as a 22% background behind the BPR stage
  const dim = lerp(lerp(1, 0.6, windowed(p, 0, 0.12)), 0.08, windowed(p, 0.33, 0.4)); // lab: at most 0.1, the curve is the light
  // M: the map is hidden in the lab (GPU budget), the pressure glow remains
  const opacity = cls === "M" ? dim * (1 - windowed(p, 0.33, 0.38)) : dim;
  return { view, style, opacity };
}

let flowSeed: Float32Array | null = null;
function obsStyle(now: number, cls: string): MapStyle | null {
  const m = model();
  if (!m) return null;
  const ri = (loc: number) => m.idx.get(loc) ?? -1;
  const regionAlpha = (loc: number) => (inRegion(loc, m.borough[ri(loc)] ?? "", obs.region) ? 255 : 51);
  const sel = obs.selectedZone;
  let style: MapStyle;
  if (obs.layer === "demand") {
    const val = hourValues(obs.how, obs.service);
    if (!val) return null;
    const arr = Float64Array.from(m.ids, (loc) => val(loc));
    let max = 0;
    for (const v of arr) max = Math.max(max, v);
    const ramp = quantileRamp(arr);
    style = {
      key: `o:d:${obs.how}:${obs.service}:${JSON.stringify(obs.region)}`, max, edge: EDGE, polygonOpacity: 1, elevationScale: obs.view3D ? 1 : 0,
      value: (loc) => val(loc),
      fill: (loc) => { const i = ri(loc); const v = arr[i] ?? 0; return v <= 0 ? [22, 22, 22, 90] : [...ramp(i), regionAlpha(loc)]; },
    };
  } else if (obs.layer === "speed") {
    const ratio = speedRatioAt(obs.how);
    if (!ratio) return null;
    // COMPARE YOUR FUTURE: the borough's lab speed ratio applied to each zone (SIMULATED overlay)
    const future = obs.compare === "future" && labChanged();
    const fit = getStore(bprFit).state;
    const simFactor = (b: string) => {
      if (!future || fit.status !== "ready") return 1;
      const f = fit.data.boroughs[b];
      const r = f ? labResult(f, obs.how, lab.dm, lab.cm) : null;
      return r ? r.simSpeed / r.obsSpeed : 1;
    };
    style = {
      key: `o:s:${obs.how}:${future}:${lab.dm}:${lab.cm}:${JSON.stringify(obs.region)}`, max: 1, edge: EDGE, polygonOpacity: 1, elevationScale: 0,
      value: () => 0,
      fill: (loc) => { const r = ratio(loc); const c = speedStep(r === null ? null : r * simFactor(m.borough[ri(loc)] ?? "")); return c ? [...c, regionAlpha(loc)] : [41, 41, 41, 160]; },
      simulated: future ? new Set(m.ids) : undefined,
    };
  } else if (obs.layer === "clusters") {
    const cl = clusterOf(), pu = annual("pickups");
    if (!cl || !pu) return null;
    let max = 0;
    for (const v of pu) max = Math.max(max, v);
    style = {
      key: `o:c:${JSON.stringify(obs.region)}`, max, edge: EDGE, polygonOpacity: 1, elevationScale: obs.view3D ? 1 : 0,
      value: (loc) => pu[ri(loc)] ?? 0,
      fill: (loc) => { const c = cl[ri(loc)] ?? -1; return c >= 0 ? [...CLUSTER_RGB[c % 3]!, regionAlpha(loc) === 255 ? 235 : 51] : [41, 41, 41, 160]; },
    };
  } else {
    const net = getNetwork();
    if (!net) return null;
    const pr = new Map(net.nodes.map((n) => [n.zone, n.pagerank]));
    const arr = Float64Array.from(m.ids, (loc) => pr.get(loc) ?? 0);
    let max = 0;
    for (const v of arr) max = Math.max(max, v);
    const ramp = quantileRamp(arr);
    style = {
      key: `o:n:${sel}:${obs.how}:${JSON.stringify(obs.region)}`, max, edge: EDGE, polygonOpacity: 1, elevationScale: obs.view3D ? 1 : 0,
      value: (loc) => pr.get(loc) ?? 0,
      fill: (loc) => [...ramp(ri(loc)), regionAlpha(loc)],
    };
    const od = getOdTop();
    if (od && sel !== null) {
      const band = hourBandOf(obs.how % 24, od.bands).id;
      const rows = od.rows.filter((r) => r[2] === band && (r[0] === sel || r[1] === sel)).sort((a, b) => b[3] - a[3]).slice(0, 25);
      const top = rows[0]?.[3] ?? 1;
      style.arcs = rows.flatMap((r) => {
        const a = m.idx.get(r[0]), b = m.idx.get(r[1]);
        return a === undefined || b === undefined ? [] : [{ from: [m.lon[a]!, m.lat[a]!] as [number, number], to: [m.lon[b]!, m.lat[b]!] as [number, number], w: r[3] / top }];
      });
      style.key += `:${band}`;
    }
  }
  // Flows (DERIVED): pulses on straight centroid-to-centroid lines, top pairs of the hour band, seeded phases
  if (style && obs.flows && motionEnabled()) {
    const od = getOdTop();
    if (od) {
      const band = hourBandOf(obs.how % 24, od.bands).id;
      const rows = bandRows(od, band, cls === "M" ? 150 : 300);
      if (!flowSeed) { flowSeed = new Float32Array(2000); let s = 7; for (let i = 0; i < 2000; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; flowSeed[i] = s / 2 ** 32; } }
      const top = rows[0]?.[3] ?? 1;
      style.flows = rows.flatMap((r, i) => {
        const a = m.idx.get(r[0]), b = m.idx.get(r[1]);
        if (a === undefined || b === undefined) return [];
        const t = ((now / 1000) * (0.12 + 0.18 * (r[3] / top)) + flowSeed![i]!) % 1;
        return [{ pos: [lerp(m.lon[a]!, m.lon[b]!, t), lerp(m.lat[a]!, m.lat[b]!, t)] as [number, number], a: Math.sin(Math.PI * t) }];
      });
    }
  }
  return style;
}

function obsFrame(w: number, h: number, now: number, api: MapApi): MapFrame | null {
  const m = model();
  const sec = document.getElementById("observatory");
  if (!m || !sec) return null;
  const cls = viewportClass(w);
  const pitch = obs.view3D ? (cls === "M" ? 40 : 45) : 0;
  const city = { ...mapView(m, w, h, cls), pitch, bearing: -18 };
  let target: MapViewState = city;
  const vp = api.viewport(w, h);
  if (obs.scale !== "city") {
    const idx = obs.scale === "zone" && obs.selectedZone !== null ? [m.idx.get(obs.selectedZone)!]
      : obs.region?.kind === "borough" ? m.ids.map((_, i) => i).filter((i) => m.borough[i] === (obs.region as { name: string }).name)
      : obs.selectedZone !== null ? m.ids.map((_, i) => i).filter((i) => m.borough[i] === m.borough[m.idx.get(obs.selectedZone!)!]) : [];
    target = fitTo(idx, cls, vp, pitch) ?? city;
  }
  const key = `${obs.scale}:${JSON.stringify(obs.region)}:${obs.selectedZone}:${obs.view3D}:${w}x${h}`;
  const view = obs.explore ? api.currentView() : tweenView(target, key, now, obs.scale === "city" && cam.key.startsWith("city") ? 800 : 1200);
  const style = obsStyle(now, cls);
  if (!style) return null;
  const r = sec.getBoundingClientRect();
  return { view, style, opacity: 1, clip: [Math.max(0, r.top), Math.max(0, h - r.bottom)], live: obs.flows || cameraMoving(now) };
}

function closingFrame(p: number, w: number, h: number, now: number, api: MapApi): MapFrame | null {
  const f = obsFrame(w, h, now, api);
  if (!f) return null;
  const s = easeSymmetric(windowed(p, 0, 0.3));
  return { view: { ...f.view, pitch: lerp(f.view.pitch, 0, s) }, style: { ...f.style, polygonOpacity: 1 - s, flows: undefined, arcs: undefined, key: f.style.key + ":close" }, opacity: 1 - windowed(p, 0.25, 0.32), clip: undefined, live: false };
}

/** The fixed map layer. Mount once in App. */
export function MapStage() {
  useAtlas();
  const host = useRef<HTMLDivElement>(null);
  const last = useRef("");
  const geo = getGeo();

  useEffect(() => {
    if (!geo || !host.current || mapState.api) return;
    let cancelled = false;
    import("./deckMap").then(({ createMap, webglAvailable }) => {
      if (cancelled || !host.current) return;
      if (!webglAvailable()) { mapState.noGL = true; emit(); return; }
      mapState.api = createMap(host.current, geo, setHover, (loc) => { if (obs.explore && loc !== null) { obs.selectedZone = loc; emit(); } });
      handoff.deckReady = true;
      last.current = "";
      emit();
    });
    return () => { cancelled = true; };
  }, [geo]);

  useFrame((now) => {
    const a = mapState.api, el = host.current;
    if (!a || !el) return;
    const w = stageW(), h = stageH();
    const loc = locate(SCENE_ORDER);
    // OBS is normal flow: also serve it while it is partly on screen from below
    const obsEl = document.getElementById("observatory");
    const obsRect = obsEl?.getBoundingClientRect();
    const obsVisible = !!obsRect && obsRect.bottom > 0 && obsRect.top < h;
    let frame: MapFrame | null = null;
    let scene = loc?.id ?? "";
    if (motionEnabled()) {
      if (scene === "demand") frame = demandFrame(loc!.p, w, h, now);
      else if (scene === "pressure") frame = pressureFrame(loc!.p, w, h);
      else if (scene === "closing") frame = closingFrame(loc!.p, w, h, now, a);
      else if (obsVisible) { scene = "observatory"; frame = obsFrame(w, h, now, a); }
    } else {
      // reduced motion: the map draws into in-flow boxes (S04 static map, OBS), clipped to them
      const box = document.getElementById("rm-demand-map")?.getBoundingClientRect();
      if (box && box.bottom > 0 && box.top < h) { scene = "demand"; frame = rmDemandFrame(w, h, box); }
      else if (obsVisible) { scene = "observatory"; frame = obsFrame(w, h, now, a); }
    }
    mapState.scene = frame ? scene : "";
    const visible = !!frame && frame.opacity > 0.003;
    a.setRunning(visible);
    el.style.opacity = visible ? String(frame!.opacity) : "0";
    el.style.clipPath = frame?.clip ? `inset(${frame.clip[0]}px 0 ${frame.clip[1]}px 0)` : "";
    el.classList.toggle("is-explore", obs.explore && scene === "observatory");
    // out of the a11y tree when not shown; the canvas is only keyboard-reachable while exploring
    el.setAttribute("aria-hidden", visible ? "false" : "true");
    const cv = el.querySelector("canvas");
    if (cv) cv.tabIndex = obs.explore ? 0 : -1;
    if (!visible) return;
    const key = `${scene}:${JSON.stringify(frame!.view)}:${frame!.style.key}:${frame!.style.polygonOpacity.toFixed(3)}:${frame!.style.elevationScale.toFixed(3)}`;
    if (key === last.current && !frame!.live) return;
    last.current = key;
    a.update(frame!.view, frame!.style);
  }, 60);

  return <div className="map-stage" ref={host} role="img" aria-label="Extruded map of the 263 taxi zones" />;
}
