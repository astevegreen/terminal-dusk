// Shared answering for the Playwright smoke tests (not a test file: only *.e2e.ts files are tests). Since L6 (#486)
// a decision's choices are in two places: the decision's own region (yes/no, actions, countries, Pass) and, for a
// card decision (play, opening pick, discard), on each card lifted from the hand strip.
import type { ElementHandle, Locator, Page } from "@playwright/test";

/** The decision region's own buttons. */
export const decisionButtons = (page: Page): Locator => page.getByTestId("decision").getByRole("button");
/** The hand strip's chips, one per card in the hand. */
export const stripChips = (page: Page): Locator => page.getByTestId("hand").getByRole("toolbar").getByRole("button");
/** The lifted card, when one is lifted. */
export const liftedCard = (page: Page): Locator => page.locator(".game-lifted:visible");
/** The status line's "Your decision": a decision waits for this screen. */
export const yourDecision = (page: Page): Locator =>
  page.getByTestId("status-bar").getByText("Your decision", { exact: true });

/** Waits until a tapped button is gone (its answer was taken) or a "Refused:" line shows; true when it is gone. */
export async function takenOrRefused(page: Page, tapped: ElementHandle): Promise<boolean> {
  const done = await page.waitForFunction(
    (button) =>
      !button.isConnected ||
      [...document.querySelectorAll('[data-testid="decision"] output')].some((line) =>
        line.textContent?.startsWith("Refused:"),
      ),
    tapped,
  );
  await done.dispose();
  return !(await tapped.evaluate((button) => button.isConnected));
}

/** Taps `buttons` in order until one is not refused; true when an answer was taken. */
async function tapUntilTaken(page: Page, buttons: Locator): Promise<boolean> {
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = await buttons.nth(i).elementHandle();
    if (!button) return true;
    // The tap clears any old "Refused:" line; a taken answer replaces the button.
    await button.click();
    if (await takenOrRefused(page, button)) return true;
  }
  return false;
}

/**
 * Answers the waiting decision with taps (the games offer some refused moves): the decision region's buttons in
 * order, then each card in the strip, lifted in turn, with its buttons in order.
 */
export async function answerOnce(page: Page): Promise<void> {
  if (await tapUntilTaken(page, decisionButtons(page))) return;
  const chips = stripChips(page);
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
    if (await tapUntilTaken(page, liftedCard(page).getByRole("button"))) return;
  }
  throw new Error("every choice was refused");
}
