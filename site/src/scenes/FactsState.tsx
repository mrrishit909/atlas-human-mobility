import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts } from "../data/types";
import type { ArtifactSpec } from "../data/loader";

/** facts.json gates every headline: its loading / error + RETRY line, shown wherever copy depends on it. */
export function FactsState() {
  const [f, retry] = useArtifact(facts);
  if (f.status === "error") return <ErrorLine file="facts.json" reason={f.reason} attempt={f.attempt} onRetry={retry} />;
  if (f.status === "loading") return <LoadingLine file="facts.json" loaded={f.loaded} total={f.total} />;
  return null;
}

/** Any artifact a scene draws from: its own error line + RETRY, so no failure is silent (QA D-042, D-052). */
export function ArtifactError<T>({ spec, live }: { spec: ArtifactSpec<T>; live?: boolean }) {
  const [s, retry] = useArtifact(spec, false);
  return s.status === "error" ? <ErrorLine file={spec.file} reason={s.reason} attempt={s.attempt} onRetry={retry} live={live} /> : null;
}
