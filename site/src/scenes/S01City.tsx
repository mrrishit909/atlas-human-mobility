import { stageW } from "../graphics/canvas";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts, zonesIndex } from "../data/types";
import { copyS00, copyS01 } from "../data/copy";
import { useProgress } from "../scroll/hooks";
import { windowed } from "../motion/progress";
import { easeSymmetric } from "../motion/ease";
import { viewportClass } from "../graphics/ring";
import { motionEnabled } from "../state/motion";

/** S01 "The City Awakens" DOM layer, portalled into the static S01 stage (whose h1 is the LCP). */
export function S01City() {
  const portal = document.getElementById("city-portal");
  const [f] = useArtifact(facts);
  const [zi, retryZi] = useArtifact(zonesIndex);
  const noteRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLParagraphElement>(null);
  const stmtRef = useRef<HTMLDivElement>(null);
  const geom = useRef({ cy: 0, h: 0 });

  useEffect(() => {
    const h1 = document.querySelector<HTMLElement>("h1[data-hero]");
    const measure = () => {
      if (!h1) return;
      const t = h1.style.transform;
      h1.style.transform = "";
      const r = h1.getBoundingClientRect();
      const stageTop = h1.closest(".stage")?.getBoundingClientRect().top ?? 0;
      geom.current = { cy: r.top - stageTop + r.height / 2, h: r.height };
      h1.style.transform = t;
    };
    measure();
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => removeEventListener("resize", measure);
  }, []);

  // p 0-0.4: the headline shrinks to 44px (D) and rises to y 120 while the ring becomes the horizon.
  useProgress("city", (p) => {
    const h1 = document.querySelector<HTMLElement>("h1[data-hero]");
    const on = motionEnabled();
    if (h1) {
      if (!on) { h1.style.transform = ""; h1.style.opacity = ""; }
      else {
        const cls = viewportClass(stageW());
        const s = easeSymmetric(windowed(p, 0, 0.4));
        const target = cls === "D" ? 44 / 96 : cls === "T" ? 36 / 64 : 28 / 40;
        const sc = 1 + (target - 1) * s;
        const topY = cls === "M" ? 56 : 96;
        const dy = (topY + (geom.current.h * target) / 2 - geom.current.cy) * s;
        h1.style.transform = `translateY(${dy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
        // T/M: the cards take the top of the screen, so the small headline yields to them
        h1.style.opacity = cls === "D" ? "" : String(1 - windowed(p, 0.55, 0.65));
      }
    }
    const chordsGone = (1 - easeSymmetric(windowed(p, 0, 0.4))) ** 2;
    if (noteRef.current) noteRef.current.style.opacity = on ? String(chordsGone) : "1";
    if (stmtRef.current) stmtRef.current.style.opacity = on ? String(windowed(p, 0.3, 0.38)) : "1";
    if (cardsRef.current) cardsRef.current.style.opacity = on ? String(windowed(p, 0.58, 0.64)) : "1";
    // T/M: the full-width cards take the top edge, so the corner labels step aside
    if (on && viewportClass(stageW()) !== "D") document.querySelectorAll<HTMLElement>("[data-intro-corner]").forEach((c) => (c.style.opacity = String(1 - windowed(p, 0.55, 0.6))));
    if (footRef.current) footRef.current.style.opacity = on ? String(windowed(p, 0.6, 0.7)) : "1";
  });

  if (!portal) return null;
  const c0 = copyS00();
  const c1 = f.status === "ready" ? copyS01(f.data) : null;
  return createPortal(
    <>
      <p className="sr-only">{c0.alt}</p>
      {zi.status === "error" && (
        <div className="city-error"><ErrorLine file="zones_index.json" reason={zi.reason} attempt={zi.attempt} onRetry={retryZi} /></div>
      )}
      <div className="city-note" ref={noteRef}>
        <HonestyChip tag="DERIVED" />
        <span>{c0.note}</span>
      </div>
      <div className="city-statement" ref={stmtRef} style={{ opacity: 0 }}>
        <WordReveal as="h2" className="city-statement__h" text={STATEMENT} mode={{ kind: "scrub", track: "city", from: 0.35, to: 0.75 }} />
      </div>
      {c1 && (
        <div className="city-cards" ref={cardsRef}>
          <article className="note">
            <header className="note__head"><span>{c1.card1Head}<sup>†</sup></span></header>
            <WordReveal as="p" className="note__body" text={c1.card1Body} blur={6} mode={{ kind: "scrub", track: "city", from: 0.6, to: 0.78 }} />
            <div className="note__tag"><HonestyChip tag="OBSERVED" /></div>
          </article>
          <article className="note note--light">
            <header className="note__head"><span>{c1.card2Head}</span></header>
            <WordReveal as="p" className="note__body" text={c1.card2Body} blur={6} mode={{ kind: "scrub", track: "city", from: 0.74, to: 0.92 }} />
            <div className="note__tag"><HonestyChip tag="DERIVED" onLight /></div>
          </article>
        </div>
      )}
      {c1 && <p className="city-foot" ref={footRef}>† {c1.card1Foot}</p>}
    </>,
    portal,
  );
}
/** Static statement; its "263" is the zone count, asserted against zones_index.json in copy.test.ts. */
export const STATEMENT = "Every ride begins in one of 263 zones and ends in another.";
