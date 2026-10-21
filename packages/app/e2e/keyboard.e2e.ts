import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Presses Tab until the focused element is the button named `name` (its whole text). No clicks. */
async function tabTo(page: Page, name: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const text = await page.evaluate(() =>
      document.activeElement?.tagName === "BUTTON" ? document.activeElement.textContent : null,
    );
    if (text === name) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached the "${name}" button`);
}

/**
 * Answers the waiting decision with the keyboard only. Focus starts on the first choice; Enter presses it.
 * A refused answer leaves focus on the pressed button, so Tab moves on to the next choice and tries that.
 */
async function answerByKeyboard(page: Page): Promise<void> {
  const choices = page.getByTestId("decision").getByRole("button");
  await expect(choices.first()).toBeFocused();
  const count = await choices.count();
  for (let i = 0; i < count; i++) {
    const pressed = await page.evaluateHandle(() => document.activeElement as HTMLElement);
    await page.keyboard.press("Enter");
    // An accepted answer brings a new decision, which replaces the button; a refused one shows "Refused:".
    const refusedOrGone = await page.waitForFunction(
      (button) =>
        !button.isConnected ||
        [...document.querySelectorAll('[data-testid="decision"] output')].some((line) =>
          line.textContent?.startsWith("Refused:"),
        ),
      pressed,
    );
    await refusedOrGone.dispose();
    if (!(await pressed.evaluate((button) => button.isConnected))) return;
    expect(await pressed.evaluate((button) => button === document.activeElement)).toBe(true);
    await page.keyboard.press("Tab");
  }
}

test("keyboard only: start a game against the AI, play it to Game over, then watch and close the replay", async ({
  page,
}) => {
  await page.goto("/");
  await tabTo(page, "Play against the AI");
  await page.keyboard.press("Enter");
  await tabTo(page, "Play as LIO");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("decision")).toBeVisible();

  const gameOver = page.getByText("Game over");
  const firstChoice = page.getByTestId("decision").getByRole("button").first();
  for (let step = 0; step < 100; step++) {
    // Waits for the AI: either the human has a decision to answer or the game has ended.
    await firstChoice.or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerByKeyboard(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);

  await tabTo(page, "Watch replay");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
  await tabTo(page, "Close");
  await page.keyboard.press("Space");
  await expect(gameOver).toBeVisible();
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
});
