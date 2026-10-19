import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Taps the decision's buttons in order until one is not refused (the fixture offers some refused moves). */
async function answerOnce(page: Page): Promise<void> {
  const buttons = page.getByTestId("decision").getByRole("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    // A refusal shows at once as a "Refused:" line; an accepted answer clears it with the next frame.
    await page.waitForTimeout(150);
    if (
      !(await page
        .getByTestId("decision")
        .getByText(/^Refused:/)
        .isVisible())
    )
      return;
  }
}

test("play against the AI: pick LIO and tap through a whole game against the worker AI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await expect(page.getByText("Practice game with developer test cards")).toBeVisible();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  for (let step = 0; step < 100; step++) {
    if (await page.getByText("Game over").isVisible()) break;
    if (await page.getByTestId("decision").getByRole("button").count()) await answerOnce(page);
    else await page.waitForTimeout(100);
  }
  await expect(page.getByText("Game over")).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);

  const log = await page.getByTestId("log").innerText();
  expect(log).toMatch(/^lio /m);
  expect(log).toMatch(/^sae /m);
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play as SAE" })).toBeVisible();
});
