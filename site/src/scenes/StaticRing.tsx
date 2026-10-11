import { useEffect, useRef } from "react";
import { fitCanvas } from "../graphics/canvas";
import { drawRing, type Chord, type RingGeom } from "../graphics/ring";
import { bandRows, hourBandOf } from "../data/derive";
import { getAnchors, getOdTop, hourly, model, orbitChords, pairChords, rush, useAtlas } from "../state/atlas";
import { fanFor } from "./director";

type Props =
  | { kind: "rush"; hour: number; label: string }
  | { kind: "orbit"; label: string }
  | { kind: "dial"; anchor: number; label: string };

/**
 * Reduced-motion ring: an in-flow canvas that draws one resting state of a
 * ring scene (MOTION_SYSTEM 8: pinned tracks become static content). Redraws
 * instantly when the visitor changes a control.
 */
export function StaticRing(props: Props) {
  const v = useAtlas();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current, m = model();
    if (!c || !m) return;
    const { ctx, width: w, height: h } = fitCanvas(c, 2);
    let geom: RingGeom = { cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.42 };
    let rotation = 0;
    let sizes: Float32Array | undefined;
    let chords: Chord[] = [];
    let markers: { angle: number; color: string; outline: boolean }[] | undefined;
    if (props.kind === "rush") {
      const data = hourly(rush.service, rush.day), od = getOdTop();
      if (data) {
        let max = 0;
        for (const x of data) max = Math.max(max, x);
        sizes = new Float32Array(m.n);
        for (let i = 0; i < m.n; i++) sizes[i] = max > 0 ? 1.5 + 7 * Math.sqrt(data[i * 24 + props.hour]! / max) : 1.5;
      }
      if (od) chords = pairChords(bandRows(od, hourBandOf(props.hour, od.bands).id, 300).map((r) => [r[0], r[1], r[3]]));
    } else if (props.kind === "orbit") {
      chords = orbitChords() ?? [];
    } else {
      const a = getAnchors()?.[props.anchor];
      if (a) {
        geom = { cx: w / 2, cy: h * 0.3 + w * 0.82, r: w * 0.82 };
        rotation = -a.angle;
        chords = pairChords(fanFor(a, "all").map((r) => [r[0], r[1], r[3]]));
        markers = getAnchors()!.map((x) => ({ angle: x.angle, color: x.color, outline: x.outline }));
      }
    }
    drawRing(ctx, { geom, rotation, angles: m.angles, width: w, height: h, sizes, nodeSize: 3, nodeAlpha: 0.9, chords, chordAlpha: props.kind === "orbit" ? 0.8 : 0.7, markers,
      anchor: props.kind === "dial" ? { tick: 72 } : undefined });
  }, [v, props]);
  return <canvas ref={ref} className="static-ring" role="img" aria-label={props.label} />;
}
