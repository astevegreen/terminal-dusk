// Shared answering for the Playwright smoke tests (not a test file: only *.e2e.ts files are tests). Since L6 (#486)
// a decision's choices are in three places: the decision banner (yes/no, actions, Stop realigning, Pass), the
// glowing countries on the map (L7, #487: placings, realignments, interventions) and, for a card decision (play,
// opening pick, discard), on each card lifted from the hand strip.
import { expect } from "@playwright/test";
import type { ElementHandle, Locator, Page } from "@playwright/test";

/** The decision banner's own buttons. */
export const decisionButtons = (page: Page): Locator => page.getByTestId("decision").getByRole("button");
/** The glowing countries' buttons on the drawn map (L7, #487), one per country the decision lets you pick. */
export const countryButtons = (page: Page): Locator => page.getByTestId("map-area").locator(".dm-marker .dm-pick");
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

/**
 * Taps a choice's button and waits until its answer was taken (the decision it answered left the screen) or refused;
 * true when taken. The tap returns before the redraw, so the screen is read again only after this.
 */
export async function tapAnswer(page: Page, choice: Locator): Promise<boolean> {
  const button = await choice.elementHandle();
  if (!button) return false;
  await button.click();
  return takenOrRefused(page, button);
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

type Box = { x: number; y: number; width: number; height: number };
const within = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

/** The waiting decision's question id in the banner, which changes once its answer is taken. */
export const questionIdOf = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('[data-testid="decision"] [role="group"]')?.getAttribute("aria-labelledby") ?? null,
  );

/** Waits until the decision asked as `question` is gone (its answer was taken) or a "Refused:" line shows. */
export async function answeredOrRefused(page: Page, question: string | null): Promise<boolean> {
  const done = await page.waitForFunction((was) => {
    const now = document.querySelector('[data-testid="decision"] [role="group"]')?.getAttribute("aria-labelledby");
    if (now !== was) return "taken";
    const refused = [...document.querySelectorAll('[data-testid="decision"] output')].some((line) =>
      line.textContent?.startsWith("Refused:"),
    );
    return refused ? "refused" : false;
  }, question);
  const result = await done.jsonValue();
  await done.dispose();
  return result === "taken";
}

/**
 * Taps a glowing country as a player would (L7, #487): from the whole map when it is off the map area, then once to
 * zoom in while it is drawn under 44 px tall, then once more to pick it. Returns the button's box at the moment it
 * answered and whether the answer was taken.
 */
export async function tapCountry(page: Page, button: Locator): Promise<{ box: Box; taken: boolean }> {
  const area = await page.getByTestId("map-area").locator(".dm-view").boundingBox();
  if (area === null) throw new Error("no drawn map");
  let box = await button.boundingBox();
  if (box === null || !within(box, area)) {
    await page.getByTestId("map-area").getByRole("button", { name: "Whole map", exact: true }).click();
    box = await button.boundingBox();
  }
  if (box === null) throw new Error("the glowing country has no box");
  if (box.height < 43.5) {
    const question = await questionIdOf(page);
    await button.click();
    await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    // The zooming tap answered nothing.
    expect(await questionIdOf(page)).toBe(question);
    box = (await button.boundingBox())!;
  }
  const question = await questionIdOf(page);
  await button.click();
  return { box, taken: await answeredOrRefused(page, question) };
}

/** Taps each glowing country in turn until one is not refused; true when an answer was taken. */
async function tapCountriesUntilTaken(page: Page): Promise<boolean> {
  const count = await countryButtons(page).count();
  for (let i = 0; i < count; i++) if ((await tapCountry(page, countryButtons(page).nth(i))).taken) return true;
  return false;
}

/**
 * Answers a card decision (play, opening pick, discard) from the hand strip: lifts each card in turn and taps its
 * button that plays it for its points, or its first button, until one is taken; then the card has left the hand, so
 * nothing is lifted.
 */
export async function playFromStrip(page: Page): Promise<void> {
  const chips = stripChips(page);
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
    const buttons = liftedCard(page).getByRole("button");
    const names = await buttons.allTextContents();
    const pick = names.find((n) => n.endsWith(": points")) ?? names[0];
    if (pick === undefined || !(await tapAnswer(page, buttons.getByText(pick, { exact: true })))) continue;
    await expect(liftedCard(page)).toHaveCount(0);
    return;
  }
  throw new Error("no card in the strip offers a choice that is taken");
}

/**
 * Answers the waiting decision with taps (the games offer some refused moves): the decision banner's buttons in
 * order, then the glowing countries on the map, then each card in the strip, lifted in turn, with its buttons in
 * order.
 */
export async function answerOnce(page: Page): Promise<void> {
  if (await tapUntilTaken(page, decisionButtons(page))) return;
  if (await tapCountriesUntilTaken(page)) return;
  const chips = stripChips(page);
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
    if (await tapUntilTaken(page, liftedCard(page).getByRole("button"))) return;
  }
  throw new Error("every choice was refused");
}
