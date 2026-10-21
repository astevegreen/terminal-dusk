import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const FIRST_DECK_NOTE =
  "First deck, Eras 1 to 3 and the future cards (TEST scenario with placeholder numbers; they join on turns 2, 3 and 4)";

/** Taps the decision's buttons in order until one is not refused (the game offers some refused moves). */
async function answerOnce(page: Page): Promise<void> {
  const buttons = page.getByTestId("decision").getByRole("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = await buttons.nth(i).elementHandle();
    if (!button) return;
    await button.click();
    // An accepted answer brings a new decision, which replaces the button; a refused one leaves the button and
    // shows a "Refused:" line again.
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

/** Plays a first-deck game against the Easy AI as LIO to its end and returns the end screen's "Game over: ..." line. */
async function playToGameOver(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByText(FIRST_DECK_NOTE, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  const gameOver = page.getByText("Game over");
  const answerButton = page.getByTestId("decision").getByRole("button").first();
  for (let step = 0; step < 100; step++) {
    await answerButton.or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  const line = page.getByTestId("status-bar").getByText(/^Game over: /);
  await expect(line).toBeVisible();
  return line.innerText();
}

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
  await expect(page.getByText("LIO hand")).toBeVisible();
  await expect(page.getByText("SAE hand")).toBeVisible();
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
  await expect(status.getByText(/^Seed checked: \S+/)).toBeVisible();
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
