import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { decisionButtons, liftedCard, stripChips, takenOrRefused, yourDecision } from "./answer.ts";

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
 * Presses Enter on the focused choice, then Tab to the next one while each is refused. Focus starts on the first
 * of `choices`; a refused answer leaves focus on the pressed button. True when an answer was taken.
 */
async function enterUntilTaken(page: Page, choices: Locator): Promise<boolean> {
  await expect(choices.first()).toBeFocused();
  const count = await choices.count();
  for (let i = 0; i < count; i++) {
    const pressed = await page.evaluateHandle(() => document.activeElement as HTMLElement);
    await page.keyboard.press("Enter");
    if (await takenOrRefused(page, pressed)) return true;
    expect(await pressed.evaluate((button) => button === document.activeElement)).toBe(true);
    await page.keyboard.press("Tab");
  }
  return false;
}

/**
 * Answers the waiting decision with the keyboard only. A new decision puts focus on its first choice: a button in
 * the decision's region, or, for a card decision (L6, #486), a chip in the hand strip. Along the strip: Enter lifts
 * the card and moves focus onto its choices, Escape drops it and puts focus back on its chip, and the arrow keys
 * move to the next card.
 */
async function answerByKeyboard(page: Page): Promise<void> {
  // Focus moves once the new decision is on screen: wait for it to land on a choice or a chip.
  const landed = await page.waitForFunction(() => {
    const at = document.activeElement;
    if (at?.classList.contains("strip-chip")) return "chip";
    return at?.tagName === "BUTTON" && at.closest('[data-testid="decision"]') !== null ? "choice" : false;
  });
  const onChip = (await landed.jsonValue()) === "chip";
  await landed.dispose();
  if (!onChip) {
    expect(await enterUntilTaken(page, decisionButtons(page))).toBe(true);
    return;
  }
  const chips = stripChips(page);
  await page.keyboard.press("Home");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    await expect(chips.nth(i)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(liftedCard(page)).toHaveCount(1);
    const choices = liftedCard(page).getByRole("button");
    if ((await choices.count()) > 0 && (await enterUntilTaken(page, choices))) return;
    await page.keyboard.press("Escape");
    await expect(liftedCard(page)).toHaveCount(0);
    await expect(chips.nth(i)).toBeFocused();
    await page.keyboard.press("ArrowRight");
  }
  throw new Error("every card's choices were refused");
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
  for (let step = 0; step < 100; step++) {
    // Waits for the AI: either the human has a decision to answer or the game has ended.
    await yourDecision(page).or(gameOver).first().waitFor();
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
