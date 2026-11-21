import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";
import { expectTapTargets } from "./measure.ts";

/** Plays the test-mode game to its end: whichever side has a prompt answers it, switching the viewer to reach it. */
async function finishGame(page: Page): Promise<void> {
  const status = page.getByTestId("status-bar");
  for (let step = 0; step < 100; step++) {
    for (const side of ["LIO", "SAE"]) {
      await page.getByRole("button", { name: side, exact: true }).click();
      await expect(status).toContainText(`You play ${side}`);
      if (await status.getByText("Game over").isVisible()) return;
      // A decision waits for this side: its choices are in the decision's region or on the cards (L6, #486).
      if (await yourDecision(page).isVisible()) {
        await answerOnce(page);
        break;
      }
    }
  }
  throw new Error("the game did not end within 100 steps");
}

test("replay: finish a game, watch it back step by step, and close it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByRole("button", { name: "Watch replay" })).toHaveCount(0);
  await finishGame(page);
  await page.getByRole("button", { name: "Watch replay" }).click();

  const step = page.getByText(/^Step \d+ of \d+$/);
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  // Both hands are in the Details panel (#493).
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("LIO hand")).toBeVisible();
  await expect(page.getByText("SAE hand")).toBeVisible();
  await page.getByRole("dialog", { name: "Game details" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Game active")).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(step).toHaveText(/^Step 2 of \d+$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(step).toHaveText(/^Step 1 of \d+$/);

  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  await expectTapTargets(page);

  await page.getByRole("button", { name: "Last", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(page.getByTestId("status-bar").getByText(/^Game over/)).toBeVisible();
  await expect(page.locator(".game-top").getByText(/^Seed checked: /)).toBeVisible();
  await expect(page.getByText("test-mode")).toHaveCount(0);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch replay" })).toBeVisible();
});
