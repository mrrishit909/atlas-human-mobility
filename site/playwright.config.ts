import { defineConfig, devices } from "@playwright/test";

// Always runs against the production build (vite preview), never the dev server.
export default defineConfig({
  testDir: "e2e",
  // the QA motion suite runs under its own config (one worker, serial): npx playwright test -c playwright.qa.config.ts
  testIgnore: "motion/**",
  fullyParallel: true,
  // each worker runs deck.gl on software WebGL (SwiftShader); more than 2 starves the CPU and times out
  workers: 2,
  // shared machine (other agents build / run Playwright): one retry absorbs software-WebGL timeouts
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4301/atlas-human-mobility/" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4301/atlas-human-mobility/",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
