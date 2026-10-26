// Playwright settings for the phase 4 browser gate (A10, e2e-stack/): two browsers, a real sign-in by email code and
// a whole online game on the local Supabase stack. It is apart from playwright.config.ts, so `pnpm test:e2e` never
// runs it. Run it from this folder through the stack lock, which waits for the stack if another folder has it:
//   pnpm exec node ../../tools/stack-lock.mjs playwright test -c playwright.stack.config.ts
// The app is served on its own free port (e2e/server.ts) with the stack's URL and anon key put in its environment
// through webServer.env, which works on Windows. Without the stack's keys the config still loads, no server starts,
// and the test skips with a reason.
import { defineConfig } from "@playwright/test";
import { e2eServer } from "./e2e/server.ts";
import { stackKeys } from "./src/transport/test/localStack.ts";

const { baseURL, webServer } = e2eServer();
const keys = stackKeys();

/** Well above the app's 5 s poll (DEFAULT_POLL_MS), so a wait for the other player's move never times out early. */
const SLOW_MS = 15_000;

export default defineConfig({
  testDir: "e2e-stack",
  testMatch: "**/*.e2e.ts",
  // The test sets its own time limit for the whole game.
  timeout: 15 * 60_000,
  expect: { timeout: SLOW_MS },
  use: { baseURL, actionTimeout: SLOW_MS, navigationTimeout: SLOW_MS },
  projects: [{ name: "phone 844x390", use: { viewport: { width: 844, height: 390 } } }],
  ...(keys
    ? { webServer: { ...webServer, env: { VITE_SUPABASE_URL: keys.url, VITE_SUPABASE_ANON_KEY: keys.anonKey } } }
    : {}),
});
