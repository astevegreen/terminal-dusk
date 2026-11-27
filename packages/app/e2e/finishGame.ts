// Plays a first-deck game against the AI to its end, for the replay tests (not a test file: only *.e2e.ts files are
// tests). Moved here from vsAiReplay.e2e.ts when the map-first replay (#493) needed it too.
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";

const FIRST_DECK_NOTE =
  "First deck, the base game: 10 turns. The Thaw (Era 1) starts, The Shock (Era 2) joins on turn 4, The Fracture (Era 3) on turn 6";

/**
 * Plays a game against the Easy AI as LIO to its end and returns the end screen's "Game over: ..." line: the first
 * deck (which has no map), or with `map` the six-region map.
 */
export async function playToGameOver(page: Page, map?: "six-region"): Promise<string> {
  await page.goto("/");
  if (map === "six-region") {
    await page.getByRole("button", { name: "Play the six-region map" }).click();
  } else {
    await page.getByRole("button", { name: "Play against the AI" }).click();
    await expect(page.getByText(FIRST_DECK_NOTE, { exact: true })).toBeVisible();
  }
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 300; step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  const line = page.getByTestId("status-bar").getByText(/^Game over: /);
  await expect(line).toBeVisible();
  return line.innerText();
}
