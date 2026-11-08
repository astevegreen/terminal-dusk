// Playwright smoke tests (`pnpm test:e2e`), kept apart from Vitest: their files end in .e2e.ts.
// Each run serves the app on its own free port and starts its own server (e2e/server.ts).
// In CI a failed test runs once more with a trace (screenshots, DOM, console, network) for the report CI uploads. A
// test that fails and then passes is flaky and still fails the run: the retry is there for the trace, not to pass.
import { defineConfig } from "@playwright/test";
import { e2eServer } from "./e2e/server.ts";

const { baseURL, webServer } = e2eServer();

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "phone 844x390", use: { viewport: { width: 844, height: 390 } } },
    { name: "desktop 1280x800", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer,
});
