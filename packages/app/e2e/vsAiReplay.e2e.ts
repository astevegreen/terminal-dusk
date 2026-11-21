import { expect, test } from "@playwright/test";
import { playToGameOver } from "./finishGame.ts";

test("vs AI replay: a full first-deck game steps from the first step to the last and ends as the game did", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const endLine = await playToGameOver(page);
  expect(endLine).toMatch(/^Game over: .+, .+$/);

  await page.getByRole("button", { name: "Watch replay" }).click();
  const status = page.getByTestId("status-bar");
  const step = page.getByText(/^Step \d+ of \d+$/);
  const next = page.getByRole("button", { name: "Next" });

  // Step 1: both hands, the game still active, nothing to go back to.
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  const total = Number(/of (\d+)$/.exec(await step.innerText())![1]);
  expect(total).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
  // Both hands are in the Details panel (#493).
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("LIO hand")).toBeVisible();
  await expect(page.getByText("SAE hand")).toBeVisible();
  await page.getByRole("dialog", { name: "Game details" }).getByRole("button", { name: "Close" }).click();
  await expect(status.getByText("Game active")).toBeVisible();

  // Every step in order; no step before the last shows the result or the seed check.
  for (let k = 1; k < total; k++) {
    await expect(step).toHaveText(`Step ${k} of ${total}`);
    await expect(next).toBeEnabled();
    await expect(page.getByText("Game over")).toHaveCount(0);
    await expect(page.getByText("Seed checked")).toHaveCount(0);
    await next.click();
  }
  await expect(step).toHaveText(`Step ${total} of ${total}`);
  await expect(next).toBeDisabled();

  // The last step: the same result line as the end screen, and a seed check with a value.
  await expect(status.getByText(/^Game over: /)).toHaveText(endLine, { useInnerText: true });
  // The seed check is a line of the replay's own in the top bar (#493).
  await expect(page.locator(".game-top").getByText(/^Seed checked: \S+/)).toBeVisible();
  await expect(status.getByText("Game active")).toHaveCount(0);

  // Phone and desktop: nothing scrolls sideways and every visible button is tall enough to tap.
  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(step).toHaveText(`Step ${total - 1} of ${total}`);
  await page.getByRole("button", { name: "Last" }).click();
  await expect(step).toHaveText(`Step ${total} of ${total}`);

  // Close returns to the end screen, unchanged.
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("status-bar").getByText(/^Game over: /)).toHaveText(endLine, { useInnerText: true });
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
});
