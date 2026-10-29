import { expect, test } from "@playwright/test";

const REGIONS = ["status-bar", "map-area", "hand", "opponent", "table", "contingency", "log", "decision"];

test("game screen: every region is visible, nothing scrolls sideways, buttons are at least 44 px", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  // The side panel shows one tab at a time (L1, #464), so each region is checked with its tab open. The hand strip
  // (L6, #486) and the decision banner (L7, #487) are always on screen.
  const shownWith: [string | null, string[]][] = [
    [null, ["status-bar", "map-area", "hand", "decision"]],
    ["Details", ["opponent", "table", "contingency"]],
    ["Log", ["log"]],
  ];
  expect(shownWith.flatMap(([, ids]) => ids).sort()).toEqual([...REGIONS].sort());
  for (const [tab, ids] of shownWith) {
    if (tab !== null) await page.getByRole("tab", { name: tab, exact: true }).click();
    for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  }
  // Test mode plays on the test map (issue #366); map.e2e.ts checks its badges.
  await expect(page.getByTestId("map-area")).not.toContainText("No map in this game");

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);

  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
});
