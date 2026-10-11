/**
 * deck.gl map for S04 (lazy chunk). No basemap: extruded zone polygons only,
 * camera authored (controller off, scroll is never captured). Keyed by
 * LocationID so elevation / colour transitions are GPU attribute tweens.
 */
import { Deck } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import { WebMercatorViewport } from "@math.gl/web-mercator";
import type { MapViewState } from "./mapView";
import type { ZonesGeo } from "../data/types";

export interface MapStyle {
  /** per LocationID */
  value: (loc: number) => number;
  max: number;
  fill: (loc: number) => [number, number, number, number];
  polygonOpacity: number;
  elevationScale: number;
  key: string;
}

type Feature = ZonesGeo["features"][number] & { properties: { id: number } };

export function createMap(parent: HTMLDivElement, geo: ZonesGeo, onHover: (loc: number | null, x: number, y: number) => void) {
  let view: MapViewState = { longitude: -73.95, latitude: 40.7, zoom: 9.5, pitch: 0, bearing: 0 };
  const deck = new Deck({
    parent,
    initialViewState: view,
    controller: false,
    useDevicePixels: Math.min(devicePixelRatio || 1, innerWidth < 1024 ? 1 : 1.5),
    layers: [],
    style: { position: "absolute", inset: "0", pointerEvents: "none" },
    onError: () => undefined,
  });
  let style: MapStyle | null = null;

  const layer = (s: MapStyle) =>
    new GeoJsonLayer<Feature["properties"]>({
      id: "zones",
      data: geo as never,
      extruded: true,
      wireframe: false,
      stroked: true,
      filled: true,
      pickable: true,
      opacity: s.polygonOpacity,
      elevationScale: s.elevationScale,
      getElevation: (f: { properties: { id: number } }) => (Math.abs(s.value(f.properties.id)) / Math.max(1, s.max)) * 6000,
      getFillColor: (f: { properties: { id: number } }) => s.fill(f.properties.id),
      getLineColor: [88, 184, 225, 90],
      lineWidthMinPixels: 1,
      material: { ambient: 0.55, diffuse: 0.6, shininess: 24, specularColor: [88, 184, 225] },
      transitions: { getElevation: { duration: 800 }, getFillColor: { duration: 600 } },
      updateTriggers: { getElevation: s.key, getFillColor: s.key },
    });

  return {
    deck,
    update(v: MapViewState, s: MapStyle) {
      view = v;
      style = s;
      deck.setProps({ viewState: v, layers: [layer(s)] });
    },
    viewport(w: number, h: number) {
      return new WebMercatorViewport({ width: w, height: h, ...view });
    },
    /** project through deck's own live viewport (used by the 1px handoff parity test) */
    project(lonlat: [number, number], z = 0) {
      const vp = deck.getViewports()[0];
      return vp ? vp.project([lonlat[0], lonlat[1], z]) : null;
    },
    pick(x: number, y: number) {
      const info = deck.pickObject({ x, y, radius: 2 });
      const loc = (info?.object as Feature | undefined)?.properties?.id ?? null;
      onHover(loc, x, y);
      return loc;
    },
    hasStyle: () => !!style,
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
