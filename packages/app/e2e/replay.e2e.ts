import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Taps the decision's buttons in order until one is not refused (the fixture offers some refused moves). */
async function answerOnce(page: Page): Promise<void> {
  const buttons = page.getByTestId("decision").getByRole("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = await buttons.nth(i).elementHandle();
    if (!button) return;
    await button.click();
    const refusedOrGone = await page.waitForFunction(
      (tapped) =>
        !tapped.isConnected ||
        [...document.querySelectorAll('[data-testid="decision"] output')].some((line) =>
          line.textContent?.startsWith("Refused:"),
        ),
      button,
    );
    await refusedOrGone.dispose();
    if (!(await button.evaluate((tapped) => tapped.isConnected))) return;
  }
}

/** Plays the test-mode game to its end: whichever side has a prompt answers it, switching the viewer to reach it. */
async function finishGame(page: Page): Promise<void> {
  const status = page.getByTestId("status-bar");
  for (let step = 0; step < 100; step++) {
    for (const side of ["LIO", "SAE"]) {
      await page.getByRole("button", { name: side, exact: true }).click();
      await expect(status).toContainText(`You play ${side}`);
      if (await status.getByText("Game over").isVisible()) return;
      if ((await page.getByTestId("decision").getByRole("button").count()) > 0) {
        await answerOnce(page);
        break;
      }
    }
  }
  throw new Error("the game did not end within 100 steps");
}

test("replay: finish a game, watch it back step by step, and close it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByRole("button", { name: "Watch replay" })).toHaveCount(0);
  await finishGame(page);
  await page.getByRole("button", { name: "Watch replay" }).click();

  const step = page.getByText(/^Step \d+ of \d+$/);
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
  await expect(page.getByText("LIO hand")).toBeVisible();
  await expect(page.getByText("SAE hand")).toBeVisible();
  await expect(page.getByText("Game active")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(step).toHaveText(/^Step 2 of \d+$/);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(step).toHaveText(/^Step 1 of \d+$/);

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Last" }).click();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(page.getByText(/^Game over/)).toBeVisible();
  await expect(page.getByText(/^Seed checked: /)).toBeVisible();
  await expect(page.getByText("test-mode")).toHaveCount(0);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Test mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch replay" })).toBeVisible();
});
