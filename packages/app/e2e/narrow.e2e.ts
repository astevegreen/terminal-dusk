// The game screen on a phone held upright (375x667), found in the phase 3 gate playtest of 28 Oct: the details
// column and the log were squeezed, and a game with no map kept a full-size empty map box.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 } });

const widthOf = (page: Page, id: string): Promise<number> =>
  page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().width);

async function checkUpright(page: Page): Promise<void> {
  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  // One column: the log and the map each use (nearly) the whole width.
  expect(await widthOf(page, "log")).toBeGreaterThanOrEqual(340);
  expect(await widthOf(page, "map-area")).toBeGreaterThanOrEqual(340);
}

test("upright phone, test mode: one column, the map and the log each nearly full width", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  await checkUpright(page);
  // Test mode has a map, so its box keeps room for it.
  const mapHeight = await page.getByTestId("map-area").evaluate((el) => el.getBoundingClientRect().height);
  expect(mapHeight).toBeGreaterThanOrEqual(150);
});

test("upright phone, against the AI: a game with no map gives its map box only a line", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  await expect(page.getByTestId("map-area")).toContainText("No map in this game");
  await checkUpright(page);
  const mapHeight = await page.getByTestId("map-area").evaluate((el) => el.getBoundingClientRect().height);
  expect(mapHeight).toBeLessThanOrEqual(40);
});
