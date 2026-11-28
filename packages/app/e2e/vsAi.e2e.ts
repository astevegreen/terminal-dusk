import { expect, test } from "@playwright/test";
import { answerOnce, liftedCard, stripChips, yourDecision } from "./answer.ts";
import { openOwnerGame } from "./start.ts";

const FIRST_DECK_NOTE =
  "First deck, the base game: 10 turns. The Thaw (Era 1) starts, The Shock (Era 2) joins on turn 4, The Fracture (Era 3) on turn 6";

test("play against the AI: pick LIO and tap through a whole game against the worker AI", async ({ page }) => {
  // The full game is an owner's (#686).
  await openOwnerGame(page, "Play against the AI");
  // The game against the AI deals the real first deck (FIRST_DECK_NOTE in packages/host/src/firstDeck.ts), not the
  // developer fixture that test mode keeps.
  await expect(page.getByText(FIRST_DECK_NOTE, { exact: true })).toBeVisible();
  // A new player meets Medium; this game is against Easy, to check the choice is kept for the next game (#508).
  await expect(page.getByRole("radio", { name: "Medium" })).toBeChecked();
  await page.getByRole("radio", { name: "Easy" }).check();
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
  // Only the free game ends with the Full Game offer (#668).
  await expect(page.getByRole("region", { name: "The Full Game" })).toHaveCount(0);

  // The log is in the drawer the ticker opens (L9, #489); its Close button shuts it again.
  await page.getByTestId("ticker").click();
  const log = await page.getByTestId("log").innerText();
  expect(log).toMatch(/^LIO /m);
  expect(log).toMatch(/^SAE /m);
  await page.getByRole("dialog", { name: "Game log" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("log")).toBeHidden();
  // The finished game can be watched back, and Close returns to it.
  await page.getByRole("button", { name: "Watch replay" }).click();
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
  // The replay's Details panel names the difficulty, as the game's does (#493).
  await page.getByRole("button", { name: "Details" }).click();
  const details = page.getByRole("dialog", { name: "Game details" });
  await expect(details.getByText("AI difficulty: Easy", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Replay controls" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(gameOver).toBeVisible();
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play as SAE" })).toBeVisible();
  // New game offers the difficulty last chosen.
  await expect(page.getByRole("radio", { name: "Easy" })).toBeChecked();
});

for (const tier of ["Easy", "Medium", "Hard"]) {
  test(`against the AI, choosing ${tier} starts a game whose Details name ${tier} (#508)`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play against the AI" }).click();
    await page.getByRole("radio", { name: tier }).check();
    await page.getByRole("button", { name: "Play as SAE" }).click();
    // The first decision is answered by both sides at once, so it shows before the AI has played. Answer until the
    // log has a line of the AI's own (it plays LIO), which proves the worker AI made at this tier answers.
    const aiPlayed = page.getByTestId("log").getByText(/^LIO /);
    for (let step = 0; step < 20 && (await aiPlayed.count()) === 0; step++) {
      await yourDecision(page).waitFor();
      await answerOnce(page);
    }
    await expect(aiPlayed.first()).toBeAttached();
    await yourDecision(page).waitFor();
    await page.getByRole("button", { name: "Details" }).click();
    await expect(
      page.getByRole("dialog", { name: "Game details" }).getByText(`AI difficulty: ${tier}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
  });
}

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

test("the free Era 1 game starts from the home screen and plays its 3 turns to the end (L12)", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Play the free game: The Thaw (Era 1)" }).click();
  await expect(
    page.getByText("The free game: The Thaw (Era 1, 1991–2001) only, 3 turns", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 100; step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
});

test("the 2025-2027 game starts from the home screen and plays its 11 turns to the end (#601)", async ({ page }) => {
  test.setTimeout(240_000);
  await openOwnerGame(page, "Play the 2025-2027 game");
  await expect(page.getByText(/^The 2025-2027 game: 11 turns/)).toBeVisible();
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 600; step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "The Full Game" })).toHaveCount(0);
});

test("the AI's difficulty is kept after a reload (L11)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByRole("radio", { name: "Medium" })).toBeChecked();
  await page.getByRole("radio", { name: "Hard" }).check();
  await page.reload();
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByRole("radio", { name: "Hard" })).toBeChecked();
});
