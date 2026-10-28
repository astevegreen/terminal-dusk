import { expect, test } from "@playwright/test";

// The Playwright build has no Supabase settings, so a watch link has nothing to watch with: the app ignores it and
// opens the home screen, with no spectator request sent. The watching screen itself is checked in a browser on the
// local stack (it needs the served auth function and a game in progress).
// Skipped when the app is served against a stack (watchStack.e2e.ts covers that).
test.skip(Boolean(process.env.VITE_SUPABASE_URL), "the app is served with online play set up");

test("a watch link in a build without online play opens the home screen and sends nothing", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?watch=abc123");

  await expect(page.getByRole("heading", { name: "Terminal Dusk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play against the AI" })).toBeVisible();
  await expect(page.getByText("Watching", { exact: true })).toHaveCount(0);

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  expect(requests.filter((url) => url.includes("/rest/v1/") || url.includes("/functions/"))).toEqual([]);
});
