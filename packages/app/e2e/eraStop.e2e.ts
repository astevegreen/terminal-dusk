// The Era 1 stop (#686), in a browser at each project's size (844x390 first): a signed-out player is a free player,
// so each game against the AI ends after Era 1 with the Full Game offer; an owner (the e2e/owner test page) plays the
// same buttons past Era 1 and never sees it. The free game's own button is freeGameOffer.e2e.ts's (#668).
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";
import { expectFullGameOffer } from "./fullGameOffer.ts";
import { OWNER_PAGE } from "./start.ts";

const FREE_NOTE = "The free game: The Thaw (Era 1, 1991–2001) only, 3 turns";
const FREE_MAP_NOTE = `${FREE_NOTE}, on the six-region map (placeholder stabilities, battlegrounds and starting influence)`;
const GAMES = [
  { button: "Play against the AI", free: FREE_NOTE, full: /^First deck, the base game: 10 turns/, turns: 10 },
  { button: "Play the six-region map", free: FREE_MAP_NOTE, full: /^First deck on the six-region map/, turns: 10 },
  { button: "Play the 2025-2027 game", free: FREE_MAP_NOTE, full: /^The 2025-2027 game: 11 turns/, turns: 11 },
] as const;

/** Opens `button`'s game from the page at `url`, against the Easy AI as LIO, once the note above it is the one. */
async function start(page: Page, url: string, button: string, note: string | RegExp): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByText(note, { exact: typeof note === "string" })).toBeVisible();
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
}

/** Answers decisions until `done`, or the game ends. */
async function playUntil(page: Page, done: () => Promise<boolean>): Promise<void> {
  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 150; step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if ((await gameOver.isVisible()) || (await done())) return;
    await answerOnce(page);
  }
  throw new Error("the game went on for more than 150 answers");
}

const offer = (page: Page) => page.getByRole("region", { name: "The Full Game" });

for (const game of GAMES) {
  test(`a free player: "${game.button}" ends after Era 1 with the Full Game offer`, async ({ page }) => {
    test.setTimeout(120_000);
    await start(page, "/", game.button, game.free);
    const status = page.getByTestId("status-bar");
    await expect(status).toContainText("Turn 1 of 3");
    await playUntil(page, async () => false);
    await expect(page.getByText("Game over")).toBeVisible();
    await expect(status).toContainText(/Turn [1-3] of 3/);
    await expectFullGameOffer(page);
  });

  test(`an owner: "${game.button}" runs past Era 1 with no offer`, async ({ page }) => {
    test.setTimeout(180_000);
    await start(page, OWNER_PAGE, game.button, game.full);
    const status = page.getByTestId("status-bar");
    await expect(status).toContainText(`Turn 1 of ${game.turns}`);
    const pastEra1 = new RegExp(`Turn 4 of ${game.turns}`);
    await playUntil(page, async () => pastEra1.test(await status.innerText()));
    await expect(status).toContainText(pastEra1);
    await expect(offer(page)).toHaveCount(0);
    await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
  });
}
