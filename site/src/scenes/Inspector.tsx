import { useEffect, useRef } from "react";
import { HonestyChip } from "../components/HonestyChip";
import { int, mph } from "../data/copy";
import { howLabel } from "../data/bpr";
import { getClusters, getNetwork, getOdTop, getZhw, model, clusterOf, zhwIndex } from "../state/atlas";
import { obs, setObs } from "../state/obs";
import { Spark } from "./S04Demand";

const SERVICE_LABEL: Record<string, string> = { all: "ALL SERVICES", yellow: "YELLOW CABS", green: "GREEN CABS", fhvhv: "APP-BASED" };

/** Everything the inspector shows for one zone at the store's hour/service (pure, tested). */
export function inspect(loc: number, how: number, service: keyof typeof SERVICE_LABEL) {
  const m = model(), z = getZhw(), idx = zhwIndex(), net = getNetwork(), od = getOdTop(), cl = clusterOf(), cs = getClusters();
  if (!m || !z || !idx) return null;
  const ri = m.idx.get(loc), zi = idx.get(loc);
  if (ri === undefined || zi === undefined) return null;
  const src = z.mean_trips[service as "all"];
  const profile = Array.from({ length: 168 }, (_, h) => src[zi * 168 + h] ?? 0);
  const peak = profile.reduce((b, v, h) => (v > profile[b]! ? h : b), 0);
  const ranks = net ? [...net.nodes].sort((a, b) => b.pagerank - a.pagerank).map((n) => n.zone) : [];
  const c = cl ? cl[ri] ?? -1 : -1;
  const dest = od ? od.rows.filter((r) => r[2] === "all" && r[0] === loc).sort((a, b) => b[3] - a[3]).slice(0, 5) : [];
  return {
    loc, name: m.name[ri]!, borough: m.borough[ri]!, profile, peak,
    trips: src[zi * 168 + how] ?? null,
    speed: z.speed_mph.all[zi * 168 + how] ?? null,
    ratio: z.speed_ratio[zi * 168 + how] ?? null,
    prRank: ranks.indexOf(loc) + 1 || null,
    cluster: c >= 0 && cs ? cs.clusters.find((x) => x.id === c)?.label ?? null : null,
    dest: dest.map((r) => ({ d: r[1], name: m.name[m.idx.get(r[1]) ?? -1] ?? `ZONE ${r[1]}`, trips: r[3], min: r[5] })),
  };
}

/** Zone Inspector (interaction 9): non-modal dialog; Esc closes and focus returns to the invoker. */
export function Inspector({ returnFocus }: { returnFocus: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const loc = obs.selectedZone;
  const data = loc !== null ? inspect(loc, obs.how, obs.service) : null;
  useEffect(() => {
    if (loc === null) return;
    ref.current?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true }); // never scroll the page (OBS is normal flow)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !obs.explore) { setObs({ selectedZone: null }); returnFocus(); } };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [loc, returnFocus]);
  if (loc === null || !data) return null;
  const empty = data.trips !== null && data.trips <= 0;
  return (
    <div className="inspector" role="dialog" aria-modal="false" aria-labelledby="insp-title" ref={ref}>
      <div className="inspector__head">
        <span className="story-card__chip">ZONE {data.loc} · {data.borough.toUpperCase()}</span>
        <button type="button" className="btn-square" aria-label="Close inspector" onClick={() => { setObs({ selectedZone: null }); returnFocus(); }}>✕</button>
      </div>
      <h3 id="insp-title" tabIndex={-1} className="inspector__name">{data.name}</h3>
      <figure className="inspector__profile" aria-label={`Weekly pickup profile, ${SERVICE_LABEL[obs.service]}: peak at ${howLabel(data.peak)} with ${int(data.profile[data.peak]!)} mean pickups per hour`}>
        <Spark values={data.profile} color="#fff" w={312} h={64} marker={obs.how} />
        <figcaption className="mono-label">MON → SUN · MEAN PICKUPS PER HOUR · {SERVICE_LABEL[obs.service]}</figcaption>
      </figure>
      {empty && <p className="state-line state-line--empty">NO {SERVICE_LABEL[obs.service]} PICKUPS IN {data.name.toUpperCase()} AT {howLabel(obs.how)}</p>}
      <dl className="inspector__metrics">
        <dt>PICKUPS / HOUR · {howLabel(obs.how)}</dt><dd className="tnum">{data.trips === null ? "SUPPRESSED" : int(data.trips)}</dd>
        <dt>MEDIAN SPEED · VS OVERNIGHT</dt><dd className="tnum">{data.speed === null ? "TOO FEW TRIPS" : `${mph(data.speed)} MPH${data.ratio !== null ? ` · ${Math.round(data.ratio * 100)}%` : ""}`}</dd>
        <dt>PAGERANK RANK</dt><dd className="tnum">{data.prRank ? `${data.prRank} OF 263` : "n/a"}</dd>
        <dt>NEIGHBORHOOD TYPE</dt><dd>{data.cluster?.toUpperCase() ?? "EXCLUDED (TOO FEW TRIPS)"}</dd>
      </dl>
      <p className="mono-label">TOP DESTINATIONS · ALL HOURS</p>
      <ol className="inspector__dest">
        {data.dest.length ? data.dest.map((d) => <li key={d.d}><span>{d.name.toUpperCase()}</span><span className="tnum">{int(d.trips)} · {d.min === null ? "n/a" : Math.round(d.min)} MIN</span></li>)
          : <li className="state-line--empty">NO PUBLISHED CORRIDORS (CELLS UNDER 11 TRIPS ARE SUPPRESSED)</li>}
      </ol>
      <div className="cor-chips">
        <HonestyChip tag="OBSERVED" detail="PICKUPS, DESTINATIONS" />
        <HonestyChip tag="DERIVED" detail="SPEED RATIO, PAGERANK, TYPE" />
      </div>
    </div>
  );
}
