import { ErrorLine, LoadingLine } from "../components/StateUI";
import { useArtifact } from "../data/useArtifact";
import { facts } from "../data/types";

/** facts.json gates every headline: its loading / error + RETRY line, shown wherever copy depends on it. */
export function FactsState() {
  const [f, retry] = useArtifact(facts);
  if (f.status === "error") return <ErrorLine file="facts.json" reason={f.reason} attempt={f.attempt} onRetry={retry} />;
  if (f.status === "loading") return <LoadingLine file="facts.json" loaded={f.loaded} total={f.total} />;
  return null;
}
