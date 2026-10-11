import { useEffect, useRef } from "react";
import { addFrame } from "../motion/loop";
import { easeSmooth } from "../motion/ease";
import { motionEnabled } from "../state/motion";

/** Tabular numeral that tweens 0 -> value over 600ms when `play` turns on (no intermediate random values). */
export function CountUp({ value, play, format = (n) => Math.round(n).toLocaleString("en-US") }: { value: number; play: boolean; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // inactive cards show the real value (a 0 would read as data); activation replays 0 -> value
    if (!play || !motionEnabled()) { el.textContent = format(value); return; }
    let start = 0;
    const off = addFrame((now) => {
      if (!start) start = now;
      const e = easeSmooth(Math.min(1, (now - start) / 600));
      el.textContent = format(value * e);
      if (e >= 1) off();
    });
    return off;
  }, [value, play, format]);
  return <span ref={ref} className="tnum">{format(value)}</span>;
}
