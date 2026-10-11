/**
 * DEV GALLERY (?gallery). Not linked from the shipped nav. Every ring/chord on
 * this page is the DEV FIXTURE (evenly spaced, seeded), never data.
 */
import { useCallback, useEffect, useState } from "react";
import "../styles/gallery.css";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { Nav } from "../components/Nav";
import { StoryDeck, type DeckCard } from "../components/StoryDeck";
import { Orb } from "../components/Orb";
import { HonestyChip } from "../components/HonestyChip";
import { NotificationCard } from "../components/NotificationCard";
import { Tooltip } from "../components/Tooltip";
import { ArtifactStatus, EmptyLine, LoadingLine, RetryButton } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { missingProbe, zonesGeo } from "../data/types";
import { jumpTo, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { FIXTURE_LABEL } from "../lib/devFixture";
import { RingDemo, type RingApi } from "./RingDemo";

const SECTIONS = [
  { id: "g-intro", label: "INTRO" },
  { id: "g-reveal", label: "REVEAL" },
  { id: "g-nav", label: "NAV" },
  { id: "g-deck", label: "DECK" },
  { id: "g-orbs", label: "ORBS" },
  { id: "g-ring", label: "RING" },
  { id: "g-ui", label: "STATES" },
];

const FIELDS = ["PU_ZONE", "DO_ZONE", "PICKUP_TS", "DROPOFF_TS", "DISTANCE_MI", "DURATION_S"];
const CARDS: DeckCard[] = [
  {
    variant: "orb", chip: "ANATOMY 01 · THE ROW", title: "A journey, as the city records it.",
    visual: (
      <div className="g-card-visual">
        <Orb family="electric" size={200} />
        <ul className="g-fields">{FIELDS.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    ),
    body: <p>A PICKUP ZONE. A DROPOFF ZONE. TWO TIMESTAMPS. MILES AND SECONDS.</p>,
    tag: <HonestyChip tag="OBSERVED" />,
  },
  {
    variant: "blue", chip: "ANATOMY 02 · THREE FLEETS", title: "Three fleets, one ledger.",
    body: <p>YELLOW CABS, GREEN CABS AND APP-BASED RIDES. SAME ZONES, SAME CLOCK.</p>, tag: <HonestyChip tag="OBSERVED" />,
  },
  {
    variant: "dark", chip: "ANATOMY 03 · WHAT WE REMOVED", title: "What we removed, and why.",
    body: <p>TIMESTAMPS OUTSIDE THEIR MONTH. TRIPS THAT END BEFORE THEY BEGIN. EVERY EXCLUSION IS COUNTED.</p>,
    tag: <HonestyChip tag="OBSERVED" />,
  },
  {
    variant: "light", chip: "ANATOMY 04 · WHERE PRECISION ENDS", title: "A zone, not a street.",
    body: <p>NO COORDINATES. NO ROUTES. EVERY LINE ON THIS SITE JOINS TWO ZONE CENTERS.</p>, tag: <HonestyChip tag="OBSERVED" onLight />,
  },
];

function Label({ n, children }: { n: string; children: string }) {
  return <p className="g-label"><span>{n}</span> {children}</p>;
}

export default function Gallery() {
  const active = useActiveScene();
  const [introKey, setIntroKey] = useState(0);
  const [noteKey, setNoteKey] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [ring, setRing] = useState<RingApi | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0, on: false });
  const [geo, loadGeo] = useArtifact(zonesGeo, false);
  const [miss, loadMiss] = useArtifact(missingProbe, false);
  const [menuOpenKey, setMenuOpenKey] = useState(0);

  useEffect(() => {
    document.title = "Gallery · Atlas of Human Mobility";
    resolveInitialHash();
  }, []);
  const onApi = useCallback((a: RingApi) => setRing(a), []);
  useEffect(() => {
    Object.assign((window as unknown as { __atlas: object }).__atlas, {
      ringStep: () => ring?.step(),
      ringZoom: (s: number) => setZoom(s),
      replayNotes: () => setNoteKey((k) => k + 1),
      playIntro: () => setIntroKey((k) => k + 1),
      openSpecimenMenu: () => setMenuOpenKey((k) => k + 1),
      loadGeo, loadMissing: loadMiss,
    });
  }, [ring, loadGeo, loadMiss]);

  return (
    <div className="gallery">
      {/* 1. S00 intro geometry stub */}
      <Track id="g-intro" height="auto" label="Intro geometry stub">
        <div className="g-intro">
          <RingDemo zoom={0} dimmed={0.3} showTitle={false} />
          <p className="wordmark">ATLAS OF HUMAN MOBILITY</p>
          <p className="g-intro__code mono-label">AN AVERAGE WEEKDAY · 23:59</p>
          <WordReveal as="h1" className="hero-title" text="Millions of journeys. One living system." mode={introKey ? { kind: "time", playKey: introKey } : { kind: "value", t: 1 }} />
          <div className="g-intro__foot">
            <span className="g-fixture">{FIXTURE_LABEL}</span>
            <button type="button" className="btn-square" onClick={() => setIntroKey((k) => k + 1)}>PLAY HEADLINE</button>
          </div>
        </div>
      </Track>

      {/* 2. WordReveal, three sizes, scrubbed */}
      <Track id="g-reveal" height="250vh" landing={0.45} label="Word reveal">
        <div className="g-pad g-reveal">
          <Label n="02">WORD REVEAL · SCRUBBED BY TRACK PROGRESS</Label>
          <WordReveal as="h2" className="g-reveal__hero" text="Millions of journeys. One living system." mode={{ kind: "scrub", track: "g-reveal", from: 0, to: 0.5 }} />
          <WordReveal as="h3" className="g-reveal__section" text="The city never stops moving." mode={{ kind: "scrub", track: "g-reveal", from: 0.2, to: 0.7 }} />
          <WordReveal as="h3" className="g-reveal__title" text="Draw every ride as a line, and the city's hidden corridors appear." mode={{ kind: "scrub", track: "g-reveal", from: 0.4, to: 0.9 }} />
        </div>
      </Track>

      {/* 3. Nav specimens */}
      <Track id="g-nav" height="auto" label="Navigation">
        <div className="g-pad g-nav">
          <Label n="03">NAVIGATION · DESKTOP BAR AND MOBILE MENU (SPECIMENS)</Label>
          <div className="g-nav__row">
            <div className="g-nav__spec">
              <p className="g-caption">D · SQUARE BLUR BAR · ACTIVE BLOCK</p>
              <div className="g-nav__glass"><Nav specimen="bar" items={SPEC_ITEMS} active="corridors" onJump={() => undefined} introPlaying={false} onSkip={() => undefined} onReplay={() => undefined} /></div>
            </div>
            <div className="g-nav__spec g-nav__spec--pill">
              <p className="g-caption">T / M · MENU PILL, OPEN</p>
              <div className="g-nav__glass g-nav__glass--tall"><Nav key={menuOpenKey} specimen="pill" defaultOpen items={SPEC_ITEMS} active="corridors" onJump={() => undefined} introPlaying={false} onSkip={() => undefined} onReplay={() => undefined} /></div>
            </div>
          </div>
        </div>
      </Track>

      {/* 4. Story deck */}
      <Track id="g-deck" height="300vh" landing={0.14} label="Story deck">
        <Label n="04">STORY DECK · 300VH TRACK</Label>
        <StoryDeck track="g-deck" cards={CARDS} />
      </Track>

      {/* 5. Orbs */}
      <Track id="g-orbs" height="auto" label="Orbs">
        <div className="g-pad">
          <Label n="05">LUMINOUS ORBS · CACHED CANVAS BITMAPS</Label>
          <div className="g-orbs">
            {(["solar", "electric", "spectral"] as const).map((f) => (
              <figure key={f} className="g-orb">
                <Orb family={f} size={280} label={`${f} orb`} />
                <figcaption className="g-caption">{f.toUpperCase()}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Track>

      {/* 6. Ring R0 / R1 dial */}
      <Track id="g-ring" height="auto" label="Ring dial">
        <div className="g-ring">
          <RingDemo zoom={zoom} onApi={onApi} />
          <div className="g-ring__ui">
            <Label n="06">GIANT RING · R0 ORBIT TO R1 HORIZON DIAL</Label>
            <span className="g-fixture">{FIXTURE_LABEL}</span>
            <label className="g-range mono-label">
              ZOOM R0 → R1 <span className="tnum">{zoom.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <div className="g-row">
              <button type="button" className="btn-square" onClick={() => setZoom(0)} aria-pressed={zoom === 0}>R0</button>
              <button type="button" className="btn-square" onClick={() => setZoom(1)} aria-pressed={zoom === 1}>R1</button>
              <button type="button" className="btn-square" onClick={() => ring?.step()} disabled={zoom < 0.9}>NEXT ANCHOR</button>
            </div>
          </div>
        </div>
      </Track>

      {/* 7. Cards, chips, tooltip, state UI */}
      <Track id="g-ui" height="auto" label="Components and states">
        <div className="g-pad g-ui">
          <Label n="07">NOTIFICATIONS · HONESTY TAGS · TOOLTIP · STATES</Label>
          <div className="g-ui__grid">
            <div className="g-col">
              <NotificationCard from="FROM: THE PIPELINE" when="NOW" body="Every line on this site joins two zone centers. None of them is a route." playKey={noteKey} tag={<HonestyChip tag="DERIVED" />} />
              <NotificationCard variant="light" from="FROM: ALL ZONES" when="ALWAYS" body="The city keeps a ledger of every ride: where it began, where it ended, and when." playKey={noteKey} tag={<HonestyChip tag="OBSERVED" onLight />} />
              <button type="button" className="btn-square" onClick={() => setNoteKey((k) => k + 1)}>REPLAY TYPING</button>
            </div>
            <div className="g-col">
              <p className="g-caption">HONESTY TAGS</p>
              <div className="g-chips">
                <HonestyChip tag="OBSERVED" />
                <HonestyChip tag="DERIVED" />
                <HonestyChip tag="PREDICTED" />
                <HonestyChip tag="SIMULATED" detail="BPR" />
                <HonestyChip tag="SYNTHETIC" />
              </div>
              <p className="g-caption">TOOLTIP</p>
              <div className="g-tip-target" tabIndex={0} aria-describedby="g-tip"
                onPointerMove={(e) => setTip({ x: e.clientX, y: e.clientY, on: true })}
                onPointerLeave={() => setTip((t) => ({ ...t, on: false }))}
                onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + 24, y: r.top + 24, on: true }); }}
                onBlur={() => setTip((t) => ({ ...t, on: false }))}>
                HOVER OR FOCUS
              </div>
              <div className="tooltip is-visible g-tip-static">FIXTURE 012 → FIXTURE 140<br />SPECIMEN · NO VALUES</div>
            </div>
            <div className="g-col">
              <p className="g-caption">STATE UI · SPECIMENS</p>
              <LoadingLine file="od_top.json" loaded={42} total={100} />
              <LoadingLine file="zones_index.json" loaded={10} total={null} />
              <EmptyLine>NO PUBLISHED CORRIDORS FROM THIS ZONE IN THIS BAND. CELLS UNDER 11 TRIPS ARE SUPPRESSED.</EmptyLine>
              <RetryButton onClick={() => undefined}>RETRY</RetryButton>
              <p className="g-caption">LIVE LOADER · REAL REQUESTS</p>
              <div className="g-live" data-live="geo">
                <button type="button" className="btn-square" onClick={loadGeo} disabled={geo.status !== "initial"}>LOAD ZONES.GEOJSON</button>
                <ArtifactStatus file="zones.geojson" state={geo} retry={loadGeo} empty="NO ZONES IN THIS FILE">
                  {(d) => <p className="state-line">READY · {d.features.length} FEATURES</p>}
                </ArtifactStatus>
              </div>
              <div className="g-live" data-live="missing">
                <button type="button" className="btn-square" onClick={loadMiss} disabled={miss.status !== "initial"}>LOAD A MISSING ARTIFACT</button>
                <ArtifactStatus file="gallery_probe_missing.json" state={miss} retry={loadMiss} empty="EMPTY">
                  {() => <p className="state-line">READY</p>}
                </ArtifactStatus>
              </div>
            </div>
          </div>
        </div>
      </Track>

      <Tooltip id="g-tip" x={tip.x} y={tip.y} visible={tip.on}>
        FIXTURE 012 → FIXTURE 140<br />SPECIMEN · NO VALUES
      </Tooltip>

      <Nav items={SECTIONS} active={active} onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={false} onSkip={() => undefined} onReplay={() => setIntroKey((k) => k + 1)} />
    </div>
  );
}

const SPEC_ITEMS = [
  { id: "city", label: "CITY" }, { id: "anatomy", label: "ANATOMY" }, { id: "rush-hour", label: "RUSH HOUR" },
  { id: "corridors", label: "CORRIDORS" }, { id: "demand", label: "DEMAND" }, { id: "pressure", label: "PRESSURE" },
  { id: "futures", label: "FUTURES" }, { id: "evidence", label: "EVIDENCE" }, { id: "observatory", label: "OBSERVATORY" },
];
