import { useCallback, useEffect, useRef, useState } from "react";
import { addFrame } from "../motion/loop";
import { Reveal } from "../motion/reveal";
import { motionEnabled } from "../state/motion";

const KEY = "atlas.intro";
const seen = () => {
  try { return sessionStorage.getItem(KEY) === "done"; } catch { return false; }
};
const markSeen = () => {
  try { sessionStorage.setItem(KEY, "done"); } catch { /* storage blocked */ }
};

/**
 * STAGE A intro stub: the S00 canvas timeline is Stage B. This plays only the
 * headline sharpening (1.2s span, MOTION_SYSTEM 5.1) on the static LCP h1,
 * once per session; SKIP, Esc and any scroll input complete it.
 */
export function useIntro() {
  const [playing, setPlaying] = useState(() => motionEnabled() && !seen());
  const done = useRef(false);
  const startAt = useRef(0);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    if (h) new Reveal(h).set(1);
    markSeen();
    setPlaying(false);
  }, []);

  useEffect(() => {
    const h = document.querySelector<HTMLElement>("h1[data-hero]");
    if (!h) return;
    const reveal = new Reveal(h);
    if (!playing) { reveal.set(1); return; }
    done.current = false;
    startAt.current = 0;
    reveal.set(0);
    const off = addFrame((now) => {
      if (!startAt.current) startAt.current = now;
      if (!reveal.timed(now - startAt.current - 150)) { off(); finish(); }
    });
    const complete = () => { off(); finish(); };
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowDown", "PageDown", " ", "End"].includes(e.key)) complete();
    };
    addEventListener("wheel", complete, { passive: true, once: true });
    addEventListener("touchmove", complete, { passive: true, once: true });
    addEventListener("keydown", onKey);
    return () => {
      off();
      removeEventListener("wheel", complete);
      removeEventListener("touchmove", complete);
      removeEventListener("keydown", onKey);
    };
  }, [playing, finish]);

  const replay = useCallback(() => {
    scrollTo(0, 0);
    done.current = false;
    setPlaying(false);
    // re-enter the playing state on the next tick so the effect restarts cleanly
    queueMicrotask(() => setPlaying(motionEnabled()));
  }, []);

  return { playing, skip: finish, replay };
}
