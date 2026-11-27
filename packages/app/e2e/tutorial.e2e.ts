// The tutorial offline (#642, phase 5's gate "the tutorial passes offline"): a guest opens it with the network off,
// is coached through the first card, sees the hint and the end of the coaching, and the game goes on. It does not
// play to the end of the game (too long for one run). It runs on the built app, as players get it (builtApp.ts).
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { answerOnce, decisionButtons, yourDecision } from "./answer.ts";
import { serveBuiltApp } from "./builtApp.ts";
import { fixRandom } from "./start.ts";

// The placeholder lesson's words (packages/content/tutorial/placeholder.json) and the screen's own lines
// (packages/app/src/tutorial/TutorialScreen.tsx).
const COACH = "Placeholder: play any card from your hand.";
const HINT = "Placeholder: a hint, which never limits your answers.";
const OVER = "Placeholder: coaching is over; the game goes on.";

let app: Awaited<ReturnType<typeof serveBuiltApp>>;
test.beforeAll(async () => {
  app = await serveBuiltApp();
});
test.afterAll(async () => {
  await app.stop();
});

/** Answers whatever waits for LIO until `line` shows in the coach's corner. */
async function answerUntil(page: Page, line: Locator): Promise<void> {
  for (let step = 0; step < 60 && !(await line.isVisible()); step++) {
    await yourDecision(page).or(line).first().waitFor();
    if (await line.isVisible()) return;
    await answerOnce(page);
  }
  await expect(line).toBeVisible();
}

test("a guest plays the tutorial offline: coached, hinted, then the game goes on", async ({ page, context }) => {
  await fixRandom(page, 642);
  await page.goto(app.url);
  await expect(page.getByRole("button", { name: "Tutorial" })).toBeVisible();
  await context.setOffline(true);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  // No sign-in: the guest opens it straight from Home.
  await page.getByRole("button", { name: "Tutorial" }).click();
  await expect(page.locator(".tutorial-coach").getByText("Placeholder lesson", { exact: true })).toBeVisible();
  const coach = page.getByRole("status", { name: "Coach" });
  await answerUntil(page, coach.getByText(COACH, { exact: true }));
  await expect(coach.getByText("Placeholder chapter 1", { exact: true })).toBeVisible();

  // A choice the coach refuses is greyed out, never hidden. The placeholder's coach allows every card, so any
  // disabled button here would be a bug in the limits.
  const refused = decisionButtons(page).and(page.locator(":disabled"));
  await expect(refused).toHaveCount(0);

  // Play the card, then the hint, then the end of the coaching.
  await answerOnce(page);
  await answerUntil(page, coach.getByText(HINT, { exact: true }));
  await answerUntil(page, coach.getByText(OVER, { exact: true }));

  // The game goes on: one more play is accepted, and nothing was refused.
  await yourDecision(page).waitFor();
  await answerOnce(page);
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
  await expect(page.getByText("Game over")).toHaveCount(0);

  // Nothing left the page for the network.
  expect(requests.filter((url) => !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});
