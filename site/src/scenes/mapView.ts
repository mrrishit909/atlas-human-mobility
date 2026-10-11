import { WebMercatorViewport } from "@math.gl/web-mercator";
import type { RingModel } from "../data/derive";
import type { ViewportClass } from "../graphics/ring";

export interface MapViewState { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }

/**
 * The S04 camera, framed per viewport class (VISUAL_DESIGN S04): D the right
 * 65% (padding-left 520), T the lower 62%, M the city in y 80..520. Pitch 0
 * here: this is the exact state at the Canvas2D -> deck handoff.
 */
export function mapView(m: RingModel, w: number, h: number, cls: ViewportClass): MapViewState {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (let i = 0; i < m.n; i++) {
    minLon = Math.min(minLon, m.lon[i]!); maxLon = Math.max(maxLon, m.lon[i]!);
    minLat = Math.min(minLat, m.lat[i]!); maxLat = Math.max(maxLat, m.lat[i]!);
  }
  const padding =
    cls === "D" ? { left: Math.min(520, w * 0.36), right: 64, top: 96, bottom: 120 }
    : cls === "T" ? { left: 48, right: 48, top: h * 0.4, bottom: 110 }
    : { left: 16, right: 16, top: 80, bottom: Math.max(120, h - 520) };
  const vp = new WebMercatorViewport({ width: w, height: h }).fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding });
  return { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 0, bearing: 0 };
}

/** Screen positions of every zone centroid through the given camera. */
export function projectCentroids(m: RingModel, view: MapViewState, w: number, h: number) {
  const vp = new WebMercatorViewport({ width: w, height: h, ...view });
  const xs = new Float32Array(m.n), ys = new Float32Array(m.n);
  for (let i = 0; i < m.n; i++) {
    const [x, y] = vp.project([m.lon[i]!, m.lat[i]!]);
    xs[i] = x!; ys[i] = y!;
  }
  return { xs, ys };
}
