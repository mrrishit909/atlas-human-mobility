/**
 * deck.gl map (lazy chunk). One instance for S04, S05, OBS and S08. No
 * basemap: zone polygons only. Keyed by LocationID so elevation / colour
 * changes are GPU attribute transitions. The render loop is stopped whenever
 * no map scene is on screen (MOTION_SYSTEM 9: offscreen pause).
 */
import { Deck } from "@deck.gl/core";
import { ArcLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { FillStyleExtension, PathStyleExtension } from "@deck.gl/extensions";
import { WebMercatorViewport } from "@math.gl/web-mercator";
import type { MapViewState } from "./mapView";
import type { ZonesGeo } from "../data/types";

type RGBA = [number, number, number, number];
export interface MapStyle {
  /** per LocationID */
  value: (loc: number) => number;
  max: number;
  fill: (loc: number) => RGBA;
  polygonOpacity: number;
  elevationScale: number;
  key: string;
  /** dark zone edge so neighbours separate on the extrusion */
  edge?: RGBA;
  /** SIMULATED overlay: hatch + dashed outline on these zones (orange); empty = none */
  simulated?: Set<number>;
  arcs?: { from: [number, number]; to: [number, number]; w: number }[];
  flows?: { pos: [number, number]; a: number }[];
}

type Feature = ZonesGeo["features"][number] & { properties: { id: number } };

/** 16x16 45-degree hatch, 1px lines at 6px pitch, used as a mask (coloured by the fill). */
function hatchAtlas() {
  const c = document.createElement("canvas");
  c.width = c.height = 12;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 1.5;
  for (let k = -12; k <= 24; k += 6) { g.beginPath(); g.moveTo(k, 12); g.lineTo(k + 12, 0); g.stroke(); }
  return c;
}

let redraws = 0;
export function createMap(parent: HTMLDivElement, geo: ZonesGeo, onHover: (loc: number | null, x: number, y: number) => void, onClick: (loc: number | null) => void = () => undefined) {
  let view: MapViewState = { longitude: -73.95, latitude: 40.7, zoom: 9.5, pitch: 0, bearing: 0 };
  let controller = false;
  const deck = new Deck({
    parent,
    initialViewState: view,
    controller: false,
    useDevicePixels: Math.min(devicePixelRatio || 1, document.documentElement.clientWidth < 1024 ? 1 : 1.5),
    layers: [],
    style: { position: "absolute", inset: "0" },
    onError: () => undefined,
    onAfterRender: () => { redraws++; },
    // EXPLORE mode only (the stage ignores pointer events otherwise)
    onHover: (info) => onHover((info.object as Feature | undefined)?.properties?.id ?? null, info.x, info.y),
    onClick: (info) => onClick((info.object as Feature | undefined)?.properties?.id ?? null),
    onViewStateChange: ({ viewState }) => {
      // only in EXPLORE mode (controller on): the visitor owns the camera
      view = viewState as MapViewState;
      deck.setProps({ viewState: view });
      return viewState;
    },
  });
  const atlas = hatchAtlas();
  let running = true;

  const layers = (s: MapStyle) => {
    const out: unknown[] = [
      new GeoJsonLayer<Feature["properties"]>({
        id: "zones",
        data: geo as never,
        extruded: true,
        wireframe: !!s.edge,
        stroked: true,
        filled: true,
        pickable: true,
        opacity: s.polygonOpacity,
        elevationScale: s.elevationScale,
        getElevation: (f: { properties: { id: number } }) => (Math.abs(s.value(f.properties.id)) / Math.max(1e-9, s.max)) * 6000,
        getFillColor: (f: { properties: { id: number } }) => s.fill(f.properties.id),
        getLineColor: s.edge ?? [88, 184, 225, 90],
        lineWidthMinPixels: 1,
        material: { ambient: 0.6, diffuse: 0.55, shininess: 20, specularColor: [88, 184, 225] },
        transitions: { getElevation: { duration: 800 }, getFillColor: { duration: 600 } },
        updateTriggers: { getElevation: s.key, getFillColor: s.key },
      }),
    ];
    if (s.simulated?.size) {
      const sim = { ...geo, features: geo.features.filter((f) => s.simulated!.has((f as Feature).properties.id)) };
      out.push(
        new GeoJsonLayer({
          id: "simulated",
          data: sim as never,
          filled: true, stroked: true, extruded: false,
          getFillColor: [255, 76, 37, 150],
          getLineColor: [255, 76, 37, 230],
          lineWidthMinPixels: 1,
          fillPatternAtlas: atlas, fillPatternMask: true,
          fillPatternMapping: { hatch: { x: 0, y: 0, width: 12, height: 12, mask: true } },
          getFillPattern: () => "hatch",
          getFillPatternScale: 0.5,
          getDashArray: [6, 4], dashJustified: true,
          extensions: [new FillStyleExtension({ pattern: true }), new PathStyleExtension({ dash: true })],
        } as never),
      );
    }
    if (s.arcs?.length) {
      out.push(new ArcLayer({
        id: "arcs", data: s.arcs,
        getSourcePosition: (d: { from: [number, number] }) => d.from,
        getTargetPosition: (d: { to: [number, number] }) => d.to,
        getSourceColor: [88, 184, 225, 230], getTargetColor: [255, 255, 255, 230],
        getWidth: (d: { w: number }) => 1 + 3 * d.w, getHeight: 0.4,
      }));
    }
    if (s.flows?.length) {
      out.push(new ScatterplotLayer({
        id: "flows", data: s.flows,
        getPosition: (d: { pos: [number, number] }) => d.pos,
        getFillColor: (d: { a: number }) => [255, 76, 37, Math.round(255 * d.a)],
        radiusUnits: "pixels", getRadius: 2, parameters: { depthCompare: "always" },
        updateTriggers: { getPosition: Math.random(), getFillColor: Math.random() },
      } as never));
    }
    return out;
  };

  return {
    deck,
    update(v: MapViewState, s: MapStyle) {
      if (!controller) view = v;
      deck.setProps({ viewState: view, layers: layers(s) as never });
    },
    /** EXPLORE mode: dragPan + scrollZoom on, the visitor owns the camera */
    setController(on: boolean) {
      controller = on;
      deck.setProps({ controller: on ? { dragPan: true, scrollZoom: true, doubleClickZoom: true, touchRotate: false, dragRotate: true, keyboard: true } : false });
    },
    currentView: () => view,
    /**
     * Pause / resume deck's own rAF (offscreen pause). luma's AnimationLoop.stop()
     * would FINALIZE deck, so this only cancels and re-requests the frame.
     * ponytail: relies on AnimationLoop's _running/_cancelAnimationFrame/_requestAnimationFrame
     * (luma 9.x); re-check on a luma upgrade.
     */
    setRunning(on: boolean) {
      if (on === running || !deck.isInitialized) return;
      const loop = (deck as unknown as { animationLoop?: { _running: boolean; _cancelAnimationFrame: () => void; _requestAnimationFrame: () => void } }).animationLoop;
      if (!loop) return;
      running = on;
      if (on) { loop._running = true; loop._requestAnimationFrame(); deck.redraw("resume"); }
      else { loop._cancelAnimationFrame(); loop._running = false; }
    },
    isRunning: () => running,
    /** screen redraws so far (offscreen-pause evidence) */
    redraws: () => redraws,
    viewport(w: number, h: number) {
      return new WebMercatorViewport({ width: w, height: h, ...view });
    },
    /** project through deck's own live viewport (used by the 1px handoff parity test) */
    project(lonlat: [number, number], z = 0) {
      try {
        const vp = deck.getViewports()[0];
        return vp ? vp.project([lonlat[0], lonlat[1], z]) : null;
      } catch {
        return null; // deck not laid out yet
      }
    },
    pick(x: number, y: number) {
      const info = deck.pickObject({ x, y, radius: 2, layerIds: ["zones"] });
      const loc = (info?.object as Feature | undefined)?.properties?.id ?? null;
      onHover(loc, x, y);
      return loc;
    },
    destroy: () => deck.finalize(),
  };
}

export type MapApi = ReturnType<typeof createMap>;

/** WebGL availability probe (S04 degraded state when false). */
export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
