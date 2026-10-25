import { expect, test } from "@playwright/test";

// The Playwright build has no Supabase settings, so the online screen shows the email step with Send code off and
// the "not set up" line. The code and signed-in steps are checked in a browser by A10 on the local stack.
test("play online: the email step shows, nothing scrolls sideways, and Back returns home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play online" }).click();

  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeDisabled();
  await expect(page.getByText("Online play is not set up in this build.", { exact: true })).toBeVisible();

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Terminal Dusk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play against the AI" })).toBeVisible();
});
