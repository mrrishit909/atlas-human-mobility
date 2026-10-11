import { defineConfig, devices } from "@playwright/test";

// QA motion suite (P01-QA-001). Always runs against the production build (vite preview), never the dev server.
export default defineConfig({
  testDir: "e2e/motion",
  fullyParallel: false,
  // each worker runs deck.gl on software WebGL (SwiftShader); more than 2 starves the CPU and times out
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4302/atlas-human-mobility/" },
  webServer: {
    // restart loop: other agents on this shared machine kill stray preview servers mid-run
    command: "npm run build && sh -c 'while :; do node node_modules/vite/bin/vite.js preview --port 4302 --strictPort; sleep 1; done'",
    url: "http://localhost:4302/atlas-human-mobility/",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
