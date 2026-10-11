import { useEffect } from "react";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { jumpTo, registerTrack, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { bootData, useAtlas } from "../state/atlas";
import { RingStage } from "../scenes/RingStage";
import { S01City } from "../scenes/S01City";
import { S02Anatomy } from "../scenes/S02Anatomy";
import { S03aRush } from "../scenes/S03aRush";
import { S03bCorridors } from "../scenes/S03bCorridors";
import { S04Demand } from "../scenes/S04Demand";
import { S05Pressure } from "../scenes/S05Pressure";
import { S06Futures } from "../scenes/S06Futures";
import { S07Evidence } from "../scenes/S07Evidence";
import { S08Closing } from "../scenes/S08Closing";
import { Observatory } from "../scenes/Observatory";
import { MapStage } from "../scenes/MapStage";
import { obs } from "../state/obs";
import { NAV_ITEMS, SCENES, navActive, type SceneDef } from "./scenes";
import { useIntro } from "./useIntro";

const BUILT: Record<string, (p: { id: string; height: string; landing: number }) => React.ReactElement> = {
  anatomy: S02Anatomy, "rush-hour": S03aRush, corridors: S03bCorridors, demand: S04Demand,
  pressure: S05Pressure, futures: S06Futures, evidence: S07Evidence, observatory: Observatory, closing: S08Closing,
};

function Placeholder({ s }: { s: SceneDef }) {
  return (
    <Track id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id}`}>
      <div className="placeholder">
        <p className="scene-kicker">{s.kicker}</p>
        <WordReveal as="h2" id={`${s.id}-title`} tabIndex={-1} data-scene-heading
          className={s.id === "closing" ? "placeholder__title placeholder__title--para" : "placeholder__title"}
          text={s.heading} mode={s.track === "auto" ? { kind: "value", t: 1 } : { kind: "scrub", track: s.id, from: 0, to: 0.45 }} />
      </div>
    </Track>
  );
}

/** App shell: every scene is data-bound; the ring and map stages are fixed layers under them. */
export function App() {
  useAtlas();
  const active = useActiveScene();
  const intro = useIntro();
  useEffect(() => {
    const replay = () => intro.replay();
    addEventListener("atlas:replay", replay);
    return () => removeEventListener("atlas:replay", replay);
  }, [intro]);

  useEffect(() => {
    bootData();
    const city = document.getElementById("city");
    const off = city ? registerTrack("city", city, SCENES[0]!.landing) : undefined;
    resolveInitialHash();
    return off;
  }, []);

  return (
    <>
      <MapStage />
      <RingStage />
      <S01City />
      {SCENES.slice(1).map((s) => {
        const Built = BUILT[s.id];
        return Built ? <Built key={s.id} id={s.id} height={s.track} landing={s.landing} /> : <Placeholder key={s.id} s={s} />;
      })}
      <Nav
        items={NAV_ITEMS}
        active={navActive(active)}
        onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={!intro.navIn || obs.explore}
        onSkip={intro.skip}
        onReplay={intro.replay}
      />
    </>
  );
}
