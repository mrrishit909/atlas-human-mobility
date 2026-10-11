import { stageH, stageW } from "../graphics/canvas";
import { useEffect, useRef } from "react";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { HonestyChip } from "../components/HonestyChip";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts, odRingTop, odTop, zoneHourWeek, type Service } from "../data/types";
import { copyS03a, hh, int } from "../data/copy";
import { hourBandOf, hourTotals, peaksHold, type DayType } from "../data/derive";
import { hourly, model, rush, useAtlas, emit } from "../state/atlas";
import { useProgress, useMotion } from "../scroll/hooks";
import { bandLabel, hourAt } from "./director";
import { getProgress } from "../scroll/engine";
import { ringR0c, viewportClass } from "../graphics/ring";
import { StaticRing } from "./StaticRing";
import { ArtifactError, FactsState } from "./FactsState";

const SERVICES: { id: Service; label: string; short: string }[] = [
  { id: "all", label: "ALL", short: "ALL" }, { id: "yellow", label: "YELLOW", short: "YELLOW" },
  { id: "green", label: "GREEN", short: "GREEN" }, { id: "fhvhv", label: "APP", short: "APP" },
];

/** Radio group of square items with a white active block (arrow keys move the selection). */
export function Segmented<T extends string>({ label, items, value, onChange, className = "" }: {
  label: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`seg-ctl ${className}`}
      onKeyDown={(e) => {
        const i = items.findIndex((x) => x.id === value);
        const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = items[(i + d + items.length) % items.length]!;
        onChange(next.id);
        (e.currentTarget.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus();
      }}>
      {items.map((it) => (
        <button key={it.id} type="button" role="radio" data-id={it.id} aria-checked={value === it.id} tabIndex={value === it.id ? 0 : -1}
          className="seg-ctl__item" onClick={() => onChange(it.id)}>{it.label}</button>
      ))}
    </div>
  );
}

function setParam(day: DayType, service: Service) {
  const prev = hourly(rush.service, rush.day);
  rush.prev = prev;
  rush.changedAt = performance.now();
  rush.day = day;
  rush.service = service;
  emit();
}

/** S03a The Rush Hour: ring breath scrubbed by hour, day type + service set by the visitor. */
export function S03aRush({ id, height, landing }: { id: string; height: string; landing: number }) {
  useAtlas();
  const motion = useMotion();
  const [f] = useArtifact(facts);
  const [zhw, retryZ] = useArtifact(zoneHourWeek);
  const [od] = useArtifact(odTop);
  const readout = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const m = model();
  const data = hourly(rush.service, rush.day);
  const totals = data && m ? hourTotals(data, m.n) : null;
  const weekdayAll = hourly("all", "weekday");
  const peaksOk = !!(f.status === "ready" && weekdayAll && m && peaksHold(hourTotals(weekdayAll, m.n), f.data.am_peak_hour.hour, f.data.pm_peak_hour.hour));
  // the (CHECK) needs the weekday curve: no statement until it is computed (fallback if the data failed)
  const copy = f.status === "ready" && (weekdayAll || zhw.status === "error") ? copyS03a(f.data, peaksOk) : null;
  const dayLabel = rush.day === "weekday" ? "WEEKDAY" : "WEEKEND";

  // readout follows the scrubbed hour; snaps to whole hours (tabular, no tween, no layout shift)
  const apply = (p: number) => {
    const h = Math.floor(hourAt(p));
    if (timeRef.current) timeRef.current.textContent = hh(h);
    const total = totals?.[h] ?? null;
    if (totalRef.current) totalRef.current.textContent = total === null ? "" : `${int(total)} PICKUPS / HOUR`;
    if (emptyRef.current) emptyRef.current.hidden = !(total !== null && total <= 0);
    if (bandRef.current && od.status === "ready") bandRef.current.textContent = bandLabel(hourBandOf(h, od.data.bands).id);
  };
  useProgress(id, apply);
  // data arrival / control changes re-render the readout without waiting for a scroll
  useEffect(() => apply(getProgress(id)));
  useEffect(() => {
    // position the readout at the ring centre for the current viewport class
    const place = () => {
      const g = ringR0c(stageW(), stageH(), viewportClass(stageW()));
      if (readout.current) { readout.current.style.left = `${g.cx}px`; readout.current.style.top = `${g.cy}px`; }
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  });

  const peakList = f.status === "ready" ? [0, f.data.am_peak_hour.hour, 14, f.data.pm_peak_hour.hour] : [0, 8, 14, 18];
  return (
    <Track id={id} height={height} landing={landing} label="The rush hour" className="scene scene-rush">
      <div className="rush-text">
        <p className="scene-kicker">03 · THE RUSH HOUR</p>
        {(
          <WordReveal as="h2" id={`${id}-title`} tabIndex={-1} data-scene-heading className="scene-statement"
            text={!copy ? "" : rush.day === "weekday" ? copy.statement : copy.weekendStatement}
            mode={motion ? { kind: "scrub", track: id, from: 0, to: 0.12 } : { kind: "value", t: 1 }} />
        )}
        {copy && <p className="scene-body">{rush.day === "weekday" ? copy.body(dayLabel) : copy.weekendBody}</p>}
        <div className="rush-controls">
          <Segmented label="Day type" value={rush.day} onChange={(d) => setParam(d, rush.service)}
            items={[{ id: "weekday", label: "WEEKDAY" }, { id: "weekend", label: "WEEKEND" }]} />
          <Segmented label="Service" value={rush.service} onChange={(s) => setParam(rush.day, s)}
            items={SERVICES.map((s) => ({ id: s.id, label: s.label }))} />
        </div>
        <div className="rush-tags"><HonestyChip tag="OBSERVED" detail="MEAN TRIPS PER HOUR" /></div>
        <FactsState />
        <ArtifactError spec={odRingTop} />
        {zhw.status === "loading" && <LoadingLine file="zone_hour_week.json" loaded={zhw.loaded} total={zhw.total} />}
        {zhw.status === "error" && <ErrorLine file="zone_hour_week.json" reason={zhw.reason} attempt={zhw.attempt} onRetry={retryZ} />}
      </div>
      {motion && (
        <div className="rush-readout" ref={readout} aria-hidden={!data}>
          <span className="rush-readout__time tnum" ref={timeRef}>00:00</span>
          <span className="rush-readout__day">AVERAGE {dayLabel}</span>
          <span className="rush-readout__total tnum" ref={totalRef} />
          <p className="rush-readout__empty" ref={emptyRef} hidden>NO {rush.service === "green" ? "GREEN-CAB" : rush.service === "yellow" ? "YELLOW-CAB" : rush.service === "fhvhv" ? "APP-BASED" : ""} PICKUPS RECORDED IN THIS HOUR</p>
          <span className="rush-readout__chords">CHORDS: ALL DAYS · ALL SERVICES · <span ref={bandRef} /></span>
        </div>
      )}
      {!motion && m && (
        <div className="rm-grid rm-grid--4">
          {peakList.map((h) => (
            <figure key={h} className="rm-frame">
              <StaticRing kind="rush" hour={h} label={`Ring of 263 zones at ${hh(h)}`} />
              <figcaption className="mono-label">{hh(h)} · {totals ? `${int(totals[h]!)} PICKUPS / HOUR` : ""}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {totals && (
        <div className="sr-only">{/* a 1px clipping box: a table cannot shrink below its content width */}
          <table>
            <caption>Citywide pickups per hour, average {dayLabel.toLowerCase()}, {SERVICES.find((s) => s.id === rush.service)!.label.toLowerCase()} services</caption>
            <thead><tr><th scope="col">Hour</th><th scope="col">Pickups per hour</th></tr></thead>
            <tbody>{totals.map((t, h) => <tr key={h}><td>{hh(h)}</td><td>{int(t)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Track>
  );
}
