import { stageW } from "../graphics/canvas";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SceneContext } from "../scroll/Track";
import { ArtifactError, FactsState } from "./FactsState";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts, odRingTop, zonesIndex } from "../data/types";
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
  const [ring] = useArtifact(odRingTop, false);
  const [zi, retryZi] = useArtifact(zonesIndex);
  const noteRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLParagraphElement>(null);
  const stmtRef = useRef<HTMLDivElement>(null);
  const geom = useRef({ cy: 0, h: 0 });

  // T/M: the statement always starts below the (variable-height) cards, never under them
  useEffect(() => {
    const cards = cardsRef.current, st = stmtRef.current;
    if (!cards || !st) return;
    const place = () => {
      st.style.top = "";
      if (viewportClass(stageW()) === "D") return;
      const stageTop = st.closest(".stage")?.getBoundingClientRect().top ?? 0;
      const need = cards.getBoundingClientRect().bottom - stageTop + 16;
      if (need > st.offsetTop) st.style.top = `${Math.round(need)}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(cards);
    addEventListener("resize", place);
    return () => { ro.disconnect(); removeEventListener("resize", place); };
  });

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
        // one statement per viewport (QA D-026): the shrunk headline yields as the statement arrives
        h1.style.opacity = String(1 - windowed(p, 0.3, 0.38));
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
    <SceneContext.Provider value="city">
      <p className="sr-only">{c0.alt}</p>
      {(zi.status === "error" || f.status === "error" || ring.status === "error") && (
        <div className="city-error">
          {zi.status === "error" && <ErrorLine file="zones_index.json" reason={zi.reason} attempt={zi.attempt} onRetry={retryZi} />}
          {/* the cards are bound to facts.json: say so where they are missing (QA D-041) */}
          <FactsState />
          {/* one stable place for every CITY error line: a line that moved would lose its live region */}
          <ArtifactError spec={odRingTop} />
        </div>
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
            <WordReveal as="p" className="note__body" text={c1.card1Body} blur={6} mode={{ kind: "scrub", track: "city", from: 0.6, to: 0.7 }} />
            <div className="note__tag"><HonestyChip tag="OBSERVED" /></div>
          </article>
          <article className="note note--light">
            <header className="note__head"><span>{c1.card2Head}</span></header>
            <WordReveal as="p" className="note__body" text={c1.card2Body} blur={6} mode={{ kind: "scrub", track: "city", from: 0.66, to: 0.76 }} />
            <div className="note__tag"><HonestyChip tag="DERIVED" onLight /></div>
          </article>
        </div>
      )}
      {/* reveal windows end by p 0.76 so the nav landing (0.78) is fully resolved (QA D-006) */}
      {c1 && <p className="city-foot" ref={footRef}>† {c1.card1Foot}</p>}
    </SceneContext.Provider>,
    portal,
  );
}
/** Static statement; its "263" is the zone count, asserted against zones_index.json in copy.test.ts. */
export const STATEMENT = "Every ride begins in one of 263 zones and ends in another.";
