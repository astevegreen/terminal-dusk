import { expect, test } from "@playwright/test";

const REGIONS = ["status-bar", "map-area", "hand", "opponent", "table", "contingency", "log", "decision"];

test("game screen: every region is visible, nothing scrolls sideways, buttons are at least 44 px", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  for (const id of REGIONS) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("map-area")).toContainText("Map: not designed yet");

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);

  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
});
