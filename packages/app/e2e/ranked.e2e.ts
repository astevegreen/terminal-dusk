// The "Find a ranked game" screen (#682), measured on a test page (ranked/) that draws the real RankedView from each
// snapshot: at 844x390 and 375x667 (and the large sizes of the desktop project) every state fits without sideways
// scroll, every button is a 44 px tap target, and the AI link goes where it should.
import { expect, test } from "@playwright/test";
import { expectNoPageScroll, expectTapTargets } from "./measure.ts";
import { sizesFor } from "./sizes.ts";

const VIEWS: [string, string][] = [
  ["form", "Search"],
  ["free", "Get the Full Game"],
  ["limit", "Search"],
  ["searching", "Cancel search"],
  ["started", "Open the game"],
];

for (const [view, key] of VIEWS) {
  test(`ranked ${view}: fits the screen, no sideways scroll, every button 44 px`, async ({ page }) => {
    for (const size of sizesFor(page)) {
      await page.setViewportSize(size);
      await page.goto(`/e2e/ranked/index.html?view=${view}`);
      await expect(page.getByRole("button", { name: key, exact: true })).toBeVisible();
      await expectNoPageScroll(page);
      await expectTapTargets(page);
    }
  });
}

test("ranked searching: the AI link is on the screen and goes to the AI game", async ({ page }) => {
  await page.goto("/e2e/ranked/index.html?view=searching");
  await expect(page.getByRole("status")).toContainText("Searching");
  await page.getByRole("button", { name: "Play the AI while you wait" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-last", "ai");
});

test("ranked free player: the refusal is in words and the Full Game button works", async ({ page }) => {
  await page.goto("/e2e/ranked/index.html?view=free");
  await expect(page.getByRole("alert")).toContainText("owners of the Full Game");
  await page.getByRole("button", { name: "Get the Full Game" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-last", "full");
});
