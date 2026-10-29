import { expect, test } from "@playwright/test";
import { answerOnce, liftedCard, stripChips, yourDecision } from "./answer.ts";

const FIRST_DECK_NOTE =
  "First deck, Eras 1 to 3 and the future cards (TEST scenario with placeholder numbers; they join on turns 2, 3 and 4)";

test("play against the AI: pick LIO and tap through a whole game against the worker AI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  // The game against the AI deals the real first deck (FIRST_DECK_NOTE in packages/host/src/firstDeck.ts), not the
  // developer fixture that test mode keeps.
  await expect(page.getByText(FIRST_DECK_NOTE, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 100; step++) {
    // Waits for the AI: either the human has a decision to answer or the game has ended.
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    // The decision's own buttons, or a card's lifted from the hand strip (L6, #486).
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);

  // The log is on its own tab of the side panel (L1, #464).
  await page.getByRole("tab", { name: "Log", exact: true }).click();
  const log = await page.getByTestId("log").innerText();
  expect(log).toMatch(/^LIO /m);
  expect(log).toMatch(/^SAE /m);
  // The finished game can be watched back, and Close returns to it.
  await page.getByRole("button", { name: "Watch replay" }).click();
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(gameOver).toBeVisible();
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play as SAE" })).toBeVisible();
});

test("against the AI, the side picker says who each side is and each card shows its rules when lifted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByText("LIO (Liberal International Order): The US-led bloc of real states.")).toBeVisible();
  await expect(
    page.getByText("SAE (Strategic Authoritarian Entente): Russia and China as one unified side."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("status-bar")).toContainText("You play LIO (Liberal International Order)");
  const chips = stripChips(page);
  await expect(chips.first()).toBeVisible();
  const count = await chips.count();
  // Every card, lifted from the hand strip (L6, #486), shows its rules text from its card file under its name, so
  // no card shows a name alone.
  for (let i = 0; i < count; i++) {
    await chips.nth(i).click();
    const rules = liftedCard(page).locator(".hand-card-rules");
    await expect(rules).toBeVisible();
    expect((await rules.innerText()).trim().length).toBeGreaterThan(10);
  }
});
