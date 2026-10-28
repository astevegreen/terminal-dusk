// The six-region map against the AI (A14, #439): 6 regions and 42 boxes and Crimea in its own box, on a phone held
// upright (375x667) and at the project's own sizes.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const REGIONS = [
  "Eastern Europe and Central Asia",
  "East and South Asia",
  "Europe",
  "Middle East and North Africa",
  "Sub-Saharan Africa",
  "The Americas",
];

async function startSixRegionGame(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the six-region map" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  return page.getByTestId("map-area");
}

async function expectNoSideScroll(page: Page): Promise<void> {
  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
}

/** The whole map, then each region zoomed in, with nothing sideways. */
async function checkSixRegionMap(page: Page): Promise<void> {
  const map = await startSixRegionGame(page);
  await expect(map.locator(".map-region h3 button")).toHaveText(REGIONS);
  await expect(map.locator(".map-badge")).toHaveCount(42);
  await expect(map.locator('.map-badge[data-country="crimea"]')).toBeVisible();
  await expectNoSideScroll(page);

  let boxes = 0;
  for (const region of REGIONS) {
    await map.getByRole("button", { name: region, exact: true }).click();
    await expect(map.getByRole("heading", { name: region, exact: true })).toBeVisible();
    const regionBoxes = map.locator(".map-box");
    boxes += await regionBoxes.count();
    await expectNoSideScroll(page);
    if (region === REGIONS[0]) {
      await expect(map.locator('.map-box[data-country="crimea"]')).toContainText("Crimea");
      await expect(map.locator('.map-box[data-country="ukraine"]')).not.toContainText("Crimea");
    }
    await map.getByRole("button", { name: "Whole map" }).click();
  }
  expect(boxes).toBe(42);
}

test("the six-region map: 6 regions and 42 boxes, each region tappable, with no sideways scroll", async ({ page }) => {
  await checkSixRegionMap(page);
});

test.describe("on a phone held upright", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("the six-region map: 6 regions and 42 boxes, each region tappable, with no sideways scroll", async ({
    page,
  }) => {
    await checkSixRegionMap(page);
  });
});
