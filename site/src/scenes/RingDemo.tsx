import { useEffect, useRef, useState } from "react";
import { fitCanvas } from "../graphics/canvas";
import { drawRing, lerpGeom, ringR0, ringR1, rotationToTop, viewportClass } from "../graphics/ring";
import { FIXTURE_N, fixtureAngles, fixtureChords, fixtureFan } from "../lib/devFixture";
import { Tween } from "../motion/tween";
import { easePremium, easeSmooth, easeSymmetric } from "../motion/ease";
import { clamp } from "../lib/math";
import { useFrame, useLatest } from "../scroll/hooks";
import { motionEnabled } from "../state/motion";

/**
 * DEV FIXTURE ring dial: R0 orbit <-> R1 horizon (scrubbed zoom), and the
 * threshold-step choreography (MOTION_SYSTEM 5.6) on 263 evenly spaced nodes.
 */
const ANCHORS = [
  { node: 0, title: "Fixture node 000", color: "#58B8E1", outline: false },
  { node: 15, title: "Fixture node 015", color: "#192CE4", outline: true },
  { node: 30, title: "Fixture node 030", color: "#690DE2", outline: true },
  { node: 45, title: "Fixture node 045", color: "#FFFFFF", outline: false },
];
const ORBIT_CHORDS = fixtureChords(600);

export interface RingApi { step: () => void; zoom: (s: number) => void }

export function RingDemo({ zoom, onApi, dimmed = 1, showTitle = true }: { zoom: number; onApi?: (a: RingApi) => void; dimmed?: number; showTitle?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rot = useRef(new Tween(rotationToTop(fixtureAngles[ANCHORS[0]!.node]!), 1200, easeSmooth, true));
  const stepAt = useRef(-1e9);
  const prevAnchor = useRef<number | null>(null);
  const dirty = useRef(true);
  const zoomRef = useRef(zoom);
  const [anchor, setAnchor] = useState(0);
  const [titles, setTitles] = useState<{ cur: number; prev: number | null; key: number }>({ cur: 0, prev: null, key: 0 });
  const anchorRef = useRef(0);
  const [geomTop, setGeomTop] = useState(0);

  useEffect(() => { zoomRef.current = zoom; dirty.current = true; }, [zoom]);
  useEffect(() => {
    const mark = () => { dirty.current = true; };
    addEventListener("resize", mark);
    const snap = () => { rot.current.snap(); stepAt.current = -1e9; dirty.current = true; };
    addEventListener("atlas:snap", snap);
    return () => { removeEventListener("resize", mark); removeEventListener("atlas:snap", snap); };
  }, []);

  const step = () => {
    const now = performance.now();
    prevAnchor.current = anchorRef.current;
    const next = (anchorRef.current + 1) % ANCHORS.length;
    anchorRef.current = next;
    rot.current.retarget(rotationToTop(fixtureAngles[ANCHORS[next]!.node]!), now);
    stepAt.current = now;
    setAnchor(next);
    setTitles((t) => ({ cur: next, prev: t.cur, key: t.key + 1 }));
    dirty.current = true;
  };
  const stepRef = useLatest(step);
  useEffect(() => {
    onApi?.({ step: () => stepRef.current(), zoom: () => undefined });
  }, [onApi, stepRef]);

  useFrame((now) => {
    const c = canvas.current;
    if (!c) return;
    const moving = rot.current.update(now);
    const since = now - stepAt.current;
    const animating = moving || since < 2200;
    if (!dirty.current && !animating) return;
    dirty.current = false;
    const { ctx, width, height } = fitCanvas(c);
    const cls = viewportClass(width);
    const s = easeSymmetric(clamp(zoomRef.current));
    const geom = lerpGeom(ringR0(width, height, cls), ringR1(width, height, cls), s);
    const on = motionEnabled();
    const a = ANCHORS[anchorRef.current]!;
    // step choreography: old fan fades 200ms; new fan draws from the anchor from 600ms over 800ms
    const draw = on ? easePremium(clamp((since - 600) / 800)) : 1;
    const outgoing = on ? 1 - clamp(since / 200) : 0;
    const tick = on ? easePremium(clamp((since - 1080) / 350)) : 1;
    const arrived = !on || since > 1080;
    const nodeSize = (cls === "M" ? 2 : cls === "T" ? 3 : 4) + s * (cls === "M" ? 3 : 2);
    const horizon = s > 0.9;
    drawRing(ctx, {
      geom, rotation: rot.current.value, angles: fixtureAngles, width, height,
      nodeSize, nodeAlpha: 0.7 + 0.3 * s,
      chords: horizon ? (outgoing > 0 && prevAnchor.current !== null ? fixtureFan(ANCHORS[prevAnchor.current]!.node) : fixtureFan(a.node)) : ORBIT_CHORDS,
      chordAlpha: horizon ? (outgoing > 0 && prevAnchor.current !== null ? outgoing : 1) : (1 - s) ** 2,
      chordDraw: horizon && !(outgoing > 0 && prevAnchor.current !== null) ? draw : 1,
      anchor: horizon ? { tick: cls === "M" ? 72 : 120, tickProgress: arrived ? tick : 0 } : undefined,
      markers: horizon ? ANCHORS.map((m) => ({ index: m.node, color: m.color, outline: m.outline })) : undefined,
      opacity: dimmed,
    });
    const top = Math.round(geom.cy - geom.r);
    if (top !== geomTop) setGeomTop(top);
  });

  return (
    <>
      <canvas ref={canvas} className="ring-canvas" aria-hidden="true" data-ring-node-count={FIXTURE_N} />
      {showTitle && zoom > 0.9 && (
        <div aria-live="polite">
          {titles.prev !== null && (
            <p key={`out-${titles.key}`} className="dial-title is-out" style={{ top: geomTop - 128 }} aria-hidden="true">
              {ANCHORS[titles.prev]!.title}
            </p>
          )}
          <p key={`in-${titles.key}`} className={`dial-title ${titles.key ? "is-in" : ""}`} style={{ top: geomTop - 128 }} data-anchor={anchor}>
            {ANCHORS[titles.cur]!.title}
          </p>
        </div>
      )}
    </>
  );
}
