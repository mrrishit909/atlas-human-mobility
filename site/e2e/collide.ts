/**
 * QA L19: collision boxes are generated from the DOM, never from a hand-written selector list.
 * Inside a scope, plus every position:fixed element anywhere in the document (chapter nav, pill, corner buttons),
 * every painted text run (one box per line of each text node) and every visible control and
 * honesty chip is a box. Two boxes collide when they intersect and neither element contains the other.
 * Only containers that are hidden behind an opaque card by design are skipped (stacked story / evidence cards
 * that are not the shown one), screen-reader-only text, and the body of a closed <details>.
 */
import type { Page } from "@playwright/test";

export type Ring = { cx: number; cy: number; r: number } | null;
export interface CollisionReport { boxes: number; hits: string[] }

/** scope "body" gives the whole document. */
export function collisions(page: Page, scope: string, ring: Ring = null): Promise<CollisionReport> {
  return page.evaluate(([scope, ring]) => {
    const root = document.querySelector<HTMLElement>(scope as string);
    if (!root) return { boxes: 0, hits: [`no element ${scope}`] };
    const OCCLUDED = ".ev-ex.is-prev, .ev-ex.is-old, .story-card:not([data-active]), .sr-only, .dial-title.is-out, details:not([open]) > :not(summary)";
    const shown = (el: Element) => {
      if (el.closest(OCCLUDED)) return false;
      let o: Element | null = el, op = 1;
      while (o) {
        const cs = getComputedStyle(o);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        op *= Number(cs.opacity);
        o = o.parentElement;
      }
      return op > 0.05;
    };
    type B = { el: Element; name: string; l: number; t: number; r: number; b: number };
    const boxes: B[] = [];
    const nameOf = (el: Element) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).trim().split(/\s+/).slice(0, 2).join(".")} "${(el.textContent ?? "").trim().slice(0, 24)}"`;
    // what an ancestor with overflow clipping (ellipsis rows, scrollers) cuts away is not painted
    const clipOf = (el: Element) => {
      let l = -1e9, t = -1e9, r = 1e9, b = 1e9;
      for (let o: Element | null = el; o && o !== document.body; o = o.parentElement) {
        const cs = getComputedStyle(o);
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
          const q = o.getBoundingClientRect();
          l = Math.max(l, q.left); t = Math.max(t, q.top); r = Math.min(r, q.right); b = Math.min(b, q.bottom);
        }
      }
      return { l, t, r, b };
    };
    const onScreen = (r: DOMRect) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    // text runs: each non-empty text node, one box per rendered line, trimmed to the em box (line-height 1 lines touch, not overlap)
    const inFixed = (el: Element) => { for (let o: Element | null = el; o; o = o.parentElement) if (getComputedStyle(o).position === "fixed") return true; return false; };
    const inScope = (el: Element) => root.contains(el) || inFixed(el);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement!;
      if (!inScope(el) || !shown(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const r of Array.from(rg.getClientRects())) {
        if (!onScreen(r)) continue;
        const h = Math.min(r.height, fs), cy = (r.top + r.bottom) / 2, c = clipOf(el);
        const box = { el, name: nameOf(el), l: Math.max(r.left, c.l), t: Math.max(cy - h / 2, c.t), r: Math.min(r.right, c.r), b: Math.min(cy + h / 2, c.b) };
        if (box.r - box.l > 1 && box.b - box.t > 1) boxes.push(box);
      }
    }
    // controls and chips: their whole box
    for (const el of document.querySelectorAll("button, a[href], input, select, [role=radio], [role=tab], [role=combobox], .chip")) {
      if (!inScope(el) || !shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (onScreen(r)) boxes.push({ el, name: nameOf(el), l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!;
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (w > 2 && h > 2) hits.push(`${a.name} x ${b.name} (${Math.round(w)}x${Math.round(h)} at ${Math.round(Math.max(a.l, b.l))},${Math.round(Math.max(a.t, b.t))})`);
      }
      if (ring) {
        const g = ring as { cx: number; cy: number; r: number };
        const nx = Math.max(a.l, Math.min(g.cx, a.r)), ny = Math.max(a.t, Math.min(g.cy, a.b));
        const near = Math.hypot(nx - g.cx, ny - g.cy);
        const far = Math.max(...[[a.l, a.t], [a.r, a.t], [a.l, a.b], [a.r, a.b]].map(([x, y]) => Math.hypot(x! - g.cx, y! - g.cy)));
        if (near <= g.r + 4 && far >= g.r - 4) hits.push(`ring crosses ${a.name}`);
      }
    }
    return { boxes: boxes.length, hits: [...new Set(hits)] };
  }, [scope, ring] as const);
}
