import { createContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { registerTrack } from "./engine";

interface Props {
  id: string;
  /** Track height, e.g. "300vh". "auto" = normal flow, not pinned. */
  height: string;
  landing?: number;
  label?: string;
  className?: string;
  children: ReactNode;
}

/** The scene a component renders in (state lines use it to pick the one live region, QA D-041). */
export const SceneContext = createContext<string | null>(null);

/** A scene track: tall <section> with a sticky 100dvh stage (MOTION_SYSTEM 4). */
export function Track({ id, height, landing = 0, label, className = "", children }: Props) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => (ref.current ? registerTrack(id, ref.current, landing) : undefined), [id, landing]);
  const pinned = height !== "auto";
  return (
    <section
      id={id}
      ref={ref}
      aria-label={label}
      className={`track ${pinned ? "track--pinned" : "track--flow"} ${className}`}
      style={{ "--track-h": height } as CSSProperties}
    >
      <div className="stage">
        <div className="stage-content" data-stage-content>
          <SceneContext.Provider value={id}>{children}</SceneContext.Provider>
        </div>
      </div>
    </section>
  );
}
