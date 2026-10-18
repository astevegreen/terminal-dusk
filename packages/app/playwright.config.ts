// Playwright smoke tests (`pnpm test:e2e`), kept apart from Vitest: their files end in .e2e.ts.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  use: { baseURL: "http://localhost:5199" },
  projects: [
    { name: "phone 844x390", use: { viewport: { width: 844, height: 390 } } },
    { name: "desktop 1280x800", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "pnpm exec vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
  },
});
