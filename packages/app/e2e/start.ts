// Shared starts for the Playwright smoke tests (not a test file: only *.e2e.ts files are tests).
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** Opens the six-region map against the AI as LIO and waits for the first decision; returns the map area. */
export async function startSixRegionGame(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the six-region map" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  return page.getByTestId("map-area");
}

/** The page's whole size, so a test can check it is no taller or wider than the screen. */
export async function pageSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
}
