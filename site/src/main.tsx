import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "lenis/dist/lenis.css";
import "./styles/app.css";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { App } from "./app/App";
import { getProgress, jumpTo, startEngine } from "./scroll/engine";

const Gallery = lazy(() => import("./scenes/Gallery"));
const isGallery = document.documentElement.classList.contains("is-gallery");

// Test/evidence hook: the same instant-jump path the nav uses (deterministic captures).
Object.assign(window, { __atlas: { jumpTo, getProgress } });

startEngine();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isGallery ? (
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
