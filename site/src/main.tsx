import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "lenis/dist/lenis.css";
import "./styles/app.css";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { App } from "./app/App";
import { getProgress, jumpTo, startEngine } from "./scroll/engine";

// The dev gallery is excluded from production builds: the guard is a build-time constant, so the
// chunk is not emitted. `npm run build:gallery` (VITE_GALLERY=1, separate outDir) is for evidence only.
const GALLERY_ENABLED = import.meta.env.DEV || import.meta.env.VITE_GALLERY === "1";
const Gallery = GALLERY_ENABLED ? lazy(() => import("./scenes/Gallery")) : null;
const isGallery = !!Gallery && document.documentElement.classList.contains("is-gallery");
if (!isGallery) document.documentElement.classList.remove("is-gallery");

// Test/evidence hook: the same instant-jump path the nav uses (deterministic captures).
Object.assign(window, { __atlas: { jumpTo, getProgress } });

startEngine();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isGallery && Gallery ? (
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
