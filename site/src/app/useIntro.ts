import { useCallback, useEffect, useState } from "react";
import { addFrame } from "../motion/loop";
import { Reveal } from "../motion/reveal";
import { motionEnabled } from "../state/motion";
import { INTRO_MS, intro, introTime } from "../scenes/director";

const KEY = "atlas.intro";
const seen = () => { try { return sessionStorage.getItem(KEY) === "done"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(KEY, "done"); } catch { /* storage blocked */ } };

/**
 * S00 "The Awakening" clock (MOTION_SYSTEM 5.1). The canvas timeline lives in
 * the ring director; this drives the DOM layer from the same clock: corner
 * labels, the time code, the headline sharpening (3300-4500ms) and the nav
 * entry (4200ms). SKIP, Esc and any scroll input complete it in 350ms. Once per
 * session; reduced motion renders the end state on the first frame.
 */
export function useIntro() {
  const [playing, setPlaying] = useState(() => motionEnabled() && !seen());
  const [navIn, setNavIn] = useState(() => !playing);
  const [run, setRun] = useState(0);

  const complete = useCallback(() => {
    if (!intro.playing || intro.completeFrom >= 0) return;
    const now = performance.now();
    intro.completeFrom = introTime(now);
    intro.completeAt = now;
  }, []);

  useEffect(() => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    const reveal = h ? new Reveal(h) : null;
    const code = document.querySelector<HTMLElement>("[data-intro-code]");
    const corners = document.querySelectorAll<HTMLElement>("[data-intro-corner]");
    if (!playing) {
      intro.playing = false;
      reveal?.set(1);
      if (code) code.textContent = "23:59";
      corners.forEach((c) => (c.style.opacity = ""));
      return;
    }
    Object.assign(intro, { playing: true, start: 0, completeFrom: -1, completeAt: 0 });
    reveal?.set(0);
    let navShown = false;
    const off = addFrame((now) => {
      const t = introTime(now);
      corners.forEach((c) => (c.style.opacity = String(Math.min(1, t / 200))));
      if (code) {
        const mins = Math.floor(Math.min(1, Math.max(0, (t - 300) / 2700)) * (24 * 60 - 1));
        code.textContent = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      }
      reveal?.timed(t - 3300);
      if (!navShown && t >= 4200) { navShown = true; setNavIn(true); }
      if (t >= INTRO_MS) {
        off();
        intro.playing = false;
        reveal?.set(1);
        markSeen();
        setPlaying(false);
      }
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(e.key)) complete();
    };
    addEventListener("wheel", complete, { passive: true });
    addEventListener("touchmove", complete, { passive: true });
    addEventListener("keydown", onKey);
    return () => {
      off();
      removeEventListener("wheel", complete);
      removeEventListener("touchmove", complete);
      removeEventListener("keydown", onKey);
    };
  }, [playing, run, complete]);

  const replay = useCallback(() => {
    scrollTo(0, 0);
    if (!motionEnabled()) return; // the 0ms version is the end state
    setNavIn(false);
    setPlaying(true);
    setRun((r) => r + 1);
  }, []);

  return { playing, navIn, skip: complete, replay };
}
