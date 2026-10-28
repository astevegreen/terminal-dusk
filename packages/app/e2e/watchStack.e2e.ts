import { expect, test } from "@playwright/test";

// Watching a real game on the local Supabase stack. It runs only when WATCH_MATCH_ID names a game put in on the
// stack and the app is served with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for that stack (a spectator needs
// no sign-in, so no auth function or mail catcher is involved). Otherwise it is skipped; watch.e2e.ts covers the
// build without online play.
const matchId = process.env.WATCH_MATCH_ID;
test.skip(matchId === undefined || matchId === "", "needs WATCH_MATCH_ID and the app served against the local stack");

test("watching a game on the local stack: spectating, read-only, only spectator rows asked for", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${new URL(request.url()).pathname}`));
  await page.goto(`/?watch=${matchId}`);

  await expect(page.getByText("Spectating", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  const data = requests.filter((r) => r.includes("/rest/v1/"));
  expect(data.length).toBeGreaterThan(0);
  expect(data.every((r) => r.startsWith("GET "))).toBe(true);
  expect(requests.some((r) => r.includes("match_secret") || r.includes("/functions/"))).toBe(false);
});
