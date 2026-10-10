import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Nav } from "../components/Nav";
import { Track } from "../scroll/Track";
import { WordReveal } from "../components/WordReveal";
import { jumpTo, registerTrack, resolveInitialHash } from "../scroll/engine";
import { useActiveScene } from "../scroll/hooks";
import { NAV_ITEMS, SCENES, navActive } from "./scenes";
import { useIntro } from "./useIntro";

/** App shell: real tracks + nav; scenes are heading-only placeholders until Stage B. */
export function App() {
  const active = useActiveScene();
  const intro = useIntro();

  useEffect(() => {
    const city = document.getElementById("city");
    const off = city ? registerTrack("city", city, SCENES[0]!.landing) : undefined;
    resolveInitialHash();
    return off;
  }, []);

  const portal = document.getElementById("city-portal");
  return (
    <>
      {portal && createPortal(<p className="scene-kicker scene-kicker--city">{SCENES[0]!.kicker}</p>, portal)}
      {SCENES.slice(1).map((s) => (
        <Track key={s.id} id={s.id} height={s.track} landing={s.landing} className={`scene scene-${s.id}`}>
          <div className="placeholder">
            <p className="scene-kicker">{s.kicker}</p>
            <WordReveal
              as="h2"
              id={`${s.id}-title`}
              tabIndex={-1}
              data-scene-heading
              className={s.id === "closing" ? "placeholder__title placeholder__title--para" : "placeholder__title"}
              text={s.heading}
              mode={s.track === "auto" ? { kind: "value", t: 1 } : { kind: "scrub", track: s.id, from: 0, to: 0.45 }}
            />
          </div>
        </Track>
      ))}
      <Nav
        items={NAV_ITEMS}
        active={navActive(active)}
        onJump={(id) => jumpTo(id, undefined, { push: true, focus: true })}
        introPlaying={intro.playing}
        onSkip={intro.skip}
        onReplay={intro.replay}
      />
    </>
  );
}
