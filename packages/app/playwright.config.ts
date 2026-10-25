// Playwright smoke tests (`pnpm test:e2e`), kept apart from Vitest: their files end in .e2e.ts.
// Each run serves the app on its own free port and starts its own server (e2e/server.ts).
import { defineConfig } from "@playwright/test";
import { e2eServer } from "./e2e/server.ts";

const { baseURL, webServer } = e2eServer();

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  use: { baseURL },
  projects: [
    { name: "phone 844x390", use: { viewport: { width: 844, height: 390 } } },
    { name: "desktop 1280x800", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer,
});
