import { useEffect, useRef } from "react";
import { fitCanvas } from "../graphics/canvas";
import { drawRing } from "../graphics/ring";
import { locate } from "../scroll/engine";
import { useFrame } from "../scroll/hooks";
import { motionEnabled } from "../state/motion";
import { HANDOFF, RING_SCENES, handoff, sceneFrame } from "./director";

const SCENES_PLUS_NEXT = [...RING_SCENES, "pressure"] as const;
declare global { interface Window { __atlasRing?: { draws: number; scene: string; p: number; geom?: { cx: number; cy: number; r: number } } } }

/** The fixed ring canvas behind S00-S04 (hidden under reduced motion: scenes draw in flow). */
export function RingStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef("");
  const jumped = useRef(false);
  const dirty = useRef(true);
  useEffect(() => {
    const j = () => { jumped.current = true; dirty.current = true; };
    const d = () => { dirty.current = true; };
    addEventListener("atlas:jump", j);
    addEventListener("resize", d);
    addEventListener("atlas:redraw", d);
    window.__atlasRing = { draws: 0, scene: "", p: 0 };
    return () => { removeEventListener("atlas:jump", j); removeEventListener("resize", d); removeEventListener("atlas:redraw", d); };
  }, []);

  useFrame((now) => {
    const c = ref.current;
    if (!c || !motionEnabled()) return;
    const loc = locate(SCENES_PLUS_NEXT);
    const visible = !!loc && loc.id !== "pressure";
    const scene = loc?.id as (typeof RING_SCENES)[number];
    // S04 handoff to deck.gl
    if (visible && scene === "demand") {
      // 0.001 slack: a jump lands on an integer scrollY, so p = 0.65 can read as 0.6499
      const want = handoff.deckReady && (handoff.on ? loc.p >= HANDOFF - 0.02 : loc.p >= HANDOFF - 0.001);
      if (want !== handoff.on) { handoff.on = want; handoff.at = jumped.current ? -1e9 : now; }
    } else if (handoff.on) { handoff.on = false; handoff.at = -1e9; }
    const fade = Math.min(1, (now - handoff.at) / 200);
    const ringOpacity = !visible ? 0 : handoff.on ? 1 - fade : scene === "demand" ? fade : 1;
    c.style.opacity = String(ringOpacity);
    if (!visible || ringOpacity <= 0) return;
    const { width, height } = { width: c.clientWidth, height: c.clientHeight };
    const frame = sceneFrame(scene, loc.p, width, height, now, jumped.current);
    jumped.current = false;
    if (!frame) return;
    const key = `${scene}:${loc.p.toFixed(5)}:${width}x${height}`;
    if (!frame.live && !dirty.current && key === last.current && fade >= 1) return;
    last.current = key;
    dirty.current = false;
    const fit = fitCanvas(c);
    drawRing(fit.ctx, { ...frame.opts, width: fit.width, height: fit.height });
    frame.extra?.(fit.ctx);
    window.__atlasRing!.draws++;
    window.__atlasRing!.scene = scene;
    window.__atlasRing!.p = loc.p;
    window.__atlasRing!.geom = frame.opts.xy ? undefined : { ...frame.opts.geom }; // for layout tests (text vs ring)
  }, 50);

  return <canvas ref={ref} className="ring-stage" aria-hidden="true" />;
}
