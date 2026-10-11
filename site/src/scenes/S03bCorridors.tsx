import { stageH, stageW } from "../graphics/canvas";
import { useEffect, useState } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { Tooltip } from "../components/Tooltip";
import { ErrorLine, LoadingLine, EmptyLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts, odTop, type OdTopRow } from "../data/types";
import { copyS03b, int } from "../data/copy";
import { dial, getAnchors, loadDemandData, model, useAtlas } from "../state/atlas";
import { useFrame, useMotion, useProgress } from "../scroll/hooks";
import { bandLabel, currentAnchor, fanFor, fanGeometry, setDial, setHover, setBand } from "./director";
import { pointAt, quadCrossY, quadPoint, ringR1, viewportClass } from "../graphics/ring";
import { StaticRing } from "./StaticRing";
import { FactsState } from "./FactsState";
import { Segmented } from "./S03aRush";

const name = (loc: number) => { const m = model(); return m ? m.name[m.idx.get(loc)!] ?? `ZONE ${loc}` : `ZONE ${loc}`; };
const mins = (v: number | null) => (v === null ? "n/a" : String(Math.round(v)));

interface Ticket { key: string; x: number; text: string }
let measureCtx: CanvasRenderingContext2D | null = null;
const textW = (s: string) => {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return s.length * 7.8;
  measureCtx.font = '13px "JetBrains Mono Variable", monospace';
  return measureCtx.measureText(s).width + 16;
};

/** Destination tickets where chords leave the bottom edge; 1D greedy collision avoidance (8px). */
export function layoutTickets(w: number, h: number, max: number): Ticket[] {
  const y = h - 96;
  const out: Ticket[] = [];
  for (const g of fanGeometry(w, h)) {
    if (out.length >= max) break;
    if (g.destVisible) continue;
    const t = quadCrossY(g.p1, g.cp, g.p2, y);
    if (t === null) continue;
    const x = quadPoint(g.p1, g.cp, g.p2, t).x;
    if (x < 0 || x > w) continue;
    const dest = currentAnchor()!.origins.has(g.row[0]) ? g.row[1] : g.row[0];
    out.push({ key: `${g.row[0]}-${g.row[1]}`, x, text: `→ ${name(dest).toUpperCase()} · ${int(g.row[3])}` });
  }
  out.sort((a, b) => a.x - b.x);
  let edge = 16;
  for (const t of out) {
    const wd = textW(t.text);
    t.x = Math.max(edge, Math.min(t.x - wd / 2, w - 16 - wd));
    edge = t.x + wd + 8;
  }
  return out;
}

/** S03b Invisible Corridors: the horizon dial, threshold-stepped through 4 anchors. */
export function S03bCorridors({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [od, retryOd] = useArtifact(odTop);
  const [tickets, setTickets] = useState<{ key: string; list: Ticket[] }>({ key: "", list: [] });
  const [tip, setTip] = useState<{ x: number; y: number; row: OdTopRow | null }>({ x: 0, y: 0, row: null });
  const [rmAnchor, setRmAnchor] = useState(0);
  const [tk, setTk] = useState({ cur: "", prev: "", n: 0 });
  const [arcTop, setArcTop] = useState(0);

  useProgress(id, (p) => { if (p > 0) loadDemandData(); }); // S04 data + deck warm up during S03
  useEffect(() => {
    const place = () => { const g = ringR1(stageW(), stageH(), viewportClass(stageW())); setArcTop(g.cy - g.r); };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, []);

  const a = currentAnchor();
  const copy = f.status === "ready" ? copyS03b(f.data) : null;
  const rows = a ? fanFor(a) : [];
  const key = a?.key ?? "";
  if (key && key !== tk.cur) setTk({ prev: tk.cur, cur: key, n: tk.n + 1 }); // derived state: re-render keyed titles

  const titleOf = (k: string) => {
    if (!copy || !k) return "";
    if (k.startsWith("Z")) return name(Number(k.slice(1)));
    return copy.states[k as keyof typeof copy.states].title;
  };
  const bodyOf = (k: string) => {
    if (!copy || !k) return "";
    if (k.startsWith("Z")) return `THE BUSIEST CORRIDORS FROM ${name(Number(k.slice(1))).toUpperCase()}, ${bandLabel(dial.band)}.`;
    const b = copy.states[k as keyof typeof copy.states].body;
    if (b) return b;
    const top = rows[0];
    return top ? `THE BUSIEST CORRIDORS START HERE: ${name(top[0]).toUpperCase()} → ${name(top[1]).toUpperCase()}.` : "";
  };

  // tickets once the rotation settles and the fan has drawn (D 6, T 4; M uses the list card)
  useFrame((now) => {
    if (!motion || dial.rot.active || now - dial.stepAt < 1500) return;
    const w = stageW(), h = stageH(), cls = viewportClass(w);
    const k = `${key}:${dial.band}:${w}x${h}`;
    if (k === tickets.key || cls === "M") return;
    setTickets({ key: k, list: layoutTickets(w, h, cls === "D" ? 6 : 4) });
  });

  const hit = (e: React.PointerEvent) => {
    const m = model();
    if (!m) return null;
    const w = stageW(), h = stageH(), g = ringR1(w, h, viewportClass(w));
    let best = -1, bd = 22;
    for (let i = 0; i < m.n; i++) {
      const p = pointAt(g, m.angles[i]! + dial.rot.value);
      const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    let found = -1;
    fanGeometry(stageW(), stageH()).forEach((g, i) => {
      if (found >= 0) return;
      for (let s = 0; s <= 24; s++) {
        const q = quadPoint(g.p1, g.cp, g.p2, s / 24);
        if (Math.hypot(q.x - e.clientX, q.y - e.clientY) < 6) { found = i; return; }
      }
    });
    setHover(found);
    setTip({ x: e.clientX, y: e.clientY, row: found >= 0 ? rows[found] ?? null : null });
  };
  const onLeave = () => { setHover(-1); setTip((t) => ({ ...t, row: null })); };
  const onClick = (e: React.PointerEvent) => { const i = hit(e); if (i !== null && i >= 0) setDial(dial.state, { zone: i }); };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const cur = dial.overridden && dial.anchor >= 0 ? dial.anchor : dial.state;
    setDial(dial.state, { anchor: (cur + d + 4) % 4 }); // holds until the next scroll threshold
  };

  const SHORT: Record<string, string> = { all: "ALL", overnight: "NIGHT", am_peak: "AM PEAK", midday: "MIDDAY", pm_peak: "PM PEAK", evening: "EVENING" };
  const bands = od.status === "ready" ? [{ id: "all", label: "ALL" }, ...od.data.bands.map((b) => ({ id: b.id, label: SHORT[b.id] ?? b.id.toUpperCase() }))] : [];
  const ledgerRows = rows.slice(0, viewportClass(typeof document !== "undefined" ? stageW() : 1440) === "M" ? 3 : 5);
  const anchorName = a && f.status === "ready" ? (a.key.startsWith("Z") ? name(Number(a.key.slice(1))) : copy?.states[a.key as "MN"].title ?? "") : "";

  return (
    <Track id={id} height={height} landing={landing} label="Invisible corridors" className="scene scene-corridors">
      <div className="cor-text">
        <p className="scene-kicker">04 · INVISIBLE CORRIDORS</p>
        <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement scene-statement--sm" text={copy?.statement ?? ""} mode={{ kind: "value", t: 1 }} />
        <p key={`b-${key}-${dial.band}`} className="scene-body cor-body" aria-live="polite">{bodyOf(key)}</p>
        <div className="cor-chips">
          <HonestyChip tag="OBSERVED" detail="CHORDS + LEDGER" />
          {a?.key === "HINGE" && <HonestyChip tag="DERIVED" detail="WEIGHTED BETWEENNESS, 2024 OD GRAPH" />}
          {motion && <HonestyChip tag="DERIVED" detail="PULSES SAMPLED FROM ZONE-TO-ZONE COUNTS, SEEDED" />}
          {!motion && <span className="mono-label">FLOWS SHOWN AS STATIC LINES</span>}
        </div>
        {bands.length > 0 && (
        <Segmented className="cor-bands" label="Hour band" value={dial.band} items={bands}
          onChange={(b) => { setBand(b); setTickets({ key: "", list: [] }); }} />
        )}

        <FactsState />
        {od.status === "loading" && <LoadingLine file="od_top.json" loaded={od.loaded} total={od.total} />}
        {od.status === "error" && <ErrorLine file="od_top.json" reason={od.reason} attempt={od.attempt} onRetry={retryOd} />}
        {od.status === "ready" && a && rows.length === 0 && (
          <EmptyLine>NO PUBLISHED CORRIDORS FROM {anchorName.toUpperCase()} IN THIS BAND. CELLS UNDER 11 TRIPS ARE SUPPRESSED.</EmptyLine>
        )}
      </div>

      {motion && copy && (
        <div className="dial-titles" aria-hidden="true">
          {tk.prev && <p key={`out-${tk.n}`} className="dial-title is-out" style={{ top: arcTop - 128 }}>{titleOf(tk.prev)}</p>}
          <p key={`in-${tk.n}`} className={`dial-title ${tk.n > 1 ? "is-in" : ""}`} style={{ top: arcTop - 128 }} data-anchor={key}>{titleOf(tk.cur)}</p>
        </div>
      )}
      {motion && <p className="sr-only" aria-live="polite">Anchor: {anchorName}</p>}

      {motion && (
        <div className="cor-hit" style={{ top: arcTop - 40 }} role="group" tabIndex={0}
          aria-label="Corridor dial. Left and right arrows change the anchor; click a node to anchor on that zone."
          onPointerMove={onMove} onPointerLeave={onLeave} onPointerUp={onClick} onKeyDown={onKey} />
      )}
      {tip.row && (
        <Tooltip x={tip.x} y={tip.y} visible>
          {name(tip.row[0]).toUpperCase()} → {name(tip.row[1]).toUpperCase()}<br />
          {int(tip.row[3])} TRIPS · MEDIAN {mins(tip.row[5])} MIN
        </Tooltip>
      )}

      <aside className="cor-ledger" aria-label="Top corridors">
        <p className="cor-ledger__head mono-label">TOP CORRIDORS · {bandLabel(dial.band)}</p>
        <ol>
          {ledgerRows.map((r) => (
            <li key={`${r[0]}-${r[1]}-${r[2]}`}>
              <span className="cor-ledger__od">{name(r[0]).toUpperCase()} → {name(r[1]).toUpperCase()}</span>
              <span className="tnum cor-ledger__full">{int(r[3])} · MEDIAN {mins(r[5])} MIN (P10-P90 {mins(r[4])}-{mins(r[6])})</span>
              <span className="tnum cor-ledger__short">{int(r[3])} · {mins(r[5])} MIN</span>
            </li>
          ))}
        </ol>
        {bands.length > 0 && (
        <Segmented className="cor-bands-m" label="Hour band (mobile)" value={dial.band} items={bands}
          onChange={(b) => { setBand(b); setTickets({ key: "", list: [] }); }} />
        )}
        {dial.overridden && <button type="button" className="btn-square cor-reset" onClick={() => { setDial(dial.state); }}>RESET DIAL</button>}
      </aside>

      {motion && (
        <div className="cor-tickets" aria-hidden="true">
          {tickets.list.map((t, i) => (
            <span key={`${tickets.key}-${t.key}`} className="ticket" style={{ left: t.x, "--i": i } as React.CSSProperties}>{t.text}</span>
          ))}
        </div>
      )}

      {!motion && (
        <div className="rm-dial">
          <div role="tablist" aria-label="Corridor anchors" className="seg-ctl">
            {(getAnchors() ?? []).map((x, i) => (
              <button key={x.key} role="tab" aria-selected={rmAnchor === i} className="seg-ctl__item" onClick={() => { setRmAnchor(i); setDial(i, { instant: true }); }}>
                {copy?.states[x.key].title.toUpperCase()}
              </button>
            ))}
          </div>
          <StaticRing kind="dial" anchor={rmAnchor} label={`Corridor dial anchored on ${copy?.states[getAnchors()?.[rmAnchor]?.key ?? "MN"].title ?? ""}`} />
        </div>
      )}
    </Track>
  );
}
