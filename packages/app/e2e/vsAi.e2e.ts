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
    // The tap clears any old "Refused:" line. An accepted answer brings a new decision, which replaces the button;
    // a refused one leaves the button and shows a "Refused:" line again.
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

test("play against the AI: pick LIO and tap through a whole game against the worker AI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByText("Practice game with developer test cards")).toBeVisible();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  const gameOver = page.getByText("Game over");
  const answerButton = page.getByTestId("decision").getByRole("button").first();
  for (let step = 0; step < 100; step++) {
    // Waits for the AI: either the human has a decision to answer or the game has ended.
    await answerButton.or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);

  const log = await page.getByTestId("log").innerText();
  expect(log).toMatch(/^lio /m);
  expect(log).toMatch(/^sae /m);
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play as SAE" })).toBeVisible();
});
