import { defineConfig, devices } from "@playwright/test";

// Always runs against the production build (vite preview), never the dev server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
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
