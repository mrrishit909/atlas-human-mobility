import { Track } from "../scroll/Track";
import { StoryDeck, type DeckCard } from "../components/StoryDeck";
import { HonestyChip } from "../components/HonestyChip";
import { Orb } from "../components/Orb";
import { CountUp } from "../components/CountUp";
import { ErrorLine, LoadingLine } from "../components/StateUI";
import { ArtifactError, FactsState } from "./FactsState";
import { useArtifact } from "../data/useArtifact";
import { facts, meta, reconciliation, type Facts, type Reconciliation } from "../data/types";
import { copyS02, pct1 } from "../data/copy";
import { ledger } from "../data/derive";
import type { LoadState } from "../data/loader";

const FIELDS = ["PU_ZONE", "DO_ZONE", "PICKUP_TS", "DROPOFF_TS", "DISTANCE_MI", "DURATION_S"];
export const REASONS: [string, string][] = [
  ["null_timestamp", "MISSING TIMESTAMP"],
  ["ts_out_of_month", "OUTSIDE ITS MONTH"],
  ["nonpositive_duration", "ENDS BEFORE IT BEGINS"],
  ["bad_duration", "UNDER 1 MIN OR OVER 6 H"],
  ["bad_distance", "ZERO, MISSING OR OVER 200 MI"],
  ["implausible_speed", "FASTER THAN 80 MPH"],
];

function Fields({ on }: { on: boolean }) {
  return (
    <div className="a-row">
      <Orb family="electric" size={200} className="a-orb" />
      <ul className={`a-fields ${on ? "is-on" : ""}`}>
        {FIELDS.map((f, i) => <li key={f} style={{ "--i": i } as React.CSSProperties}>{f}</li>)}
      </ul>
    </div>
  );
}

function Fleets({ f, on }: { f: Facts; on: boolean }) {
  const parts = [
    { k: "APP", v: f.share_pct.fhvhv, cls: "a-strip__app" },
    { k: "YELLOW", v: f.share_pct.yellow, cls: "a-strip__yellow" },
    { k: "GREEN", v: f.share_pct.green, cls: "a-strip__green" },
  ];
  return (
    <figure className={`a-strip ${on ? "is-on" : ""}`} aria-label={parts.map((p) => `${p.k} ${pct1(p.v)}%`).join(", ")}>
      <div className="a-strip__bar">
        {parts.map((p, i) => <span key={p.k} className={p.cls} style={{ flexGrow: p.v, "--i": i } as React.CSSProperties} />)}
      </div>
      <figcaption className="a-strip__labels">
        {parts.map((p) => <span key={p.k}>{p.k} <b className="tnum">{pct1(p.v)}%</b></span>)}
      </figcaption>
    </figure>
  );
}

function Ledger({ r, on }: { r: Reconciliation; on: boolean }) {
  const l = ledger(r);
  const max = Math.max(...REASONS.map(([k]) => l.reasons[k] ?? 0), 1);
  return (
    <div className={`a-ledger ${on ? "is-on" : ""}`}>
      <table>
        <caption className="sr-only">Rows excluded by reason, all fleets, 2024</caption>
        <tbody>
          {REASONS.map(([k, label], i) => (
            <tr key={k} style={{ "--i": i } as React.CSSProperties}>
              <th scope="row">{label}</th>
              <td><CountUp value={l.reasons[k] ?? 0} play={on} /></td>
              <td aria-hidden="true" className="a-ledger__bar"><i style={{ "--w": (l.reasons[k] ?? 0) / max } as React.CSSProperties} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {l.balances && <p className="a-ledger__check">RAW = KEPT + EXCLUDED ✓</p>}
    </div>
  );
}

function Grid({ on }: { on: boolean }) {
  return (
    <div className={`a-grid ${on ? "is-on" : ""}`} role="img" aria-label="263 squares, one per taxi zone">
      {Array.from({ length: 263 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
    </div>
  );
}

function ledgerState(state: LoadState<Reconciliation>, retry: () => void, on: boolean) {
  if (state.status === "ready") return <Ledger r={state.data} on={on} />;
  if (state.status === "error") return <div className="a-unavail"><p className="state-line">LEDGER UNAVAILABLE</p><ErrorLine file="reconciliation.json" reason={state.reason} attempt={state.attempt} onRetry={retry} /></div>;
  if (state.status === "loading") return <LoadingLine file="reconciliation.json" loaded={state.loaded} total={state.total} />;
  return null;
}

/** S02 Anatomy of a Journey: the story deck, bound to facts / reconciliation / meta. */
export function S02Anatomy({ id, height, landing }: { id: string; height: string; landing: number }) {
  const [f] = useArtifact(facts);
  const [m] = useArtifact(meta);
  const [r, retryR] = useArtifact(reconciliation);
  const copy = f.status === "ready" ? copyS02(f.data, m.status === "ready" ? m.data : null) : null;
  const cards: DeckCard[] = copy && f.status === "ready" ? [
    { variant: "orb", chip: copy[0]!.chip, title: copy[0]!.title, visual: (on) => <Fields on={on} />, body: <p>{copy[0]!.body}</p>, tag: <HonestyChip tag="OBSERVED" /> },
    { variant: "blue", chip: copy[1]!.chip, title: copy[1]!.title, visual: (on) => <Fleets f={f.data} on={on} />, body: <p>{copy[1]!.body}</p>, tag: <HonestyChip tag="OBSERVED" /> },
    { variant: "dark", chip: copy[2]!.chip, title: copy[2]!.title, visual: (on) => ledgerState(r, retryR, on),
      body: <><p>{copy[2]!.body}</p>{copy[2]!.foot ? <p className="a-foot">{copy[2]!.foot}</p> : <div className="a-foot"><ArtifactError spec={meta} /></div>}</>, tag: <HonestyChip tag="OBSERVED" /> },
    { variant: "light", chip: copy[3]!.chip, title: copy[3]!.title, visual: (on) => <Grid on={on} />, body: <p>{copy[3]!.body}</p>, tag: <HonestyChip tag="OBSERVED" onLight /> },
  ] : [];
  return (
    <Track id={id} height={height} landing={landing} label="Anatomy of a journey" className="scene scene-anatomy">
      <h2 className="sr-only" id={`${id}-title`} tabIndex={-1} data-scene-heading>Anatomy of a journey</h2>
      {cards.length ? <StoryDeck track={id} cards={cards} /> : <div className="scene-state"><FactsState /></div>}
    </Track>
  );
}
