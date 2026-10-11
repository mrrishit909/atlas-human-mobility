/** Size a canvas to its CSS box at a capped DPR (MOTION_SYSTEM 9: 2 on D, 1.5 on T/M). */
export function fitCanvas(canvas: HTMLCanvasElement, cap = innerWidth < 1024 ? 1.5 : 2) {
  const dpr = Math.min(devicePixelRatio || 1, cap);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: w, height: h, dpr };
}

/**
 * The stage box every scene measures from: the viewport WITHOUT classic
 * scrollbars. The fixed ring canvas, the deck canvas, the map camera and the
 * hit-testing all use this one box, so the S04 handoff stays pixel-exact on
 * systems with visible scrollbars.
 */
export const stageW = () => document.documentElement.clientWidth;
export const stageH = () => document.documentElement.clientHeight;
