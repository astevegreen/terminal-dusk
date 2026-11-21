// One thing open at a time (#503; docs/design/screen-layout.md, principle 5), run at both configured sizes in the
// six-region game against the AI. A lifted card, the log drawer and the Details panel each close when another
// opens, by keyboard as well as by touch. And with Details open over a log pinned at the side of a large screen,
// the ticker brings the log to the front and keeps it pinned, rather than closing it.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { liftedCard, stripChips } from "./answer.ts";
import { isLarge, LARGE_MONITOR, sizesFor } from "./sizes.ts";
import { startSixRegionGame } from "./start.ts";

const drawerOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game log", includeHidden: true });
const detailsOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game details", includeHidden: true });
const detailsButton = (page: Page): Locator => page.locator(".game-top").getByRole("button", { name: "Details" });
const pinOf = (page: Page): Locator => drawerOf(page).locator(".game-drawer-pin");

/** Puts the keyboard's place on `target` and presses Enter: no pointer event at all. */
async function enterOn(target: Locator): Promise<void> {
  await target.focus();
  await target.press("Enter");
}

test("by keyboard, a lifted card, Details and the log each close when another opens", async ({ page }) => {
  await startSixRegionGame(page);
  const chip = stripChips(page).first();
  const details = detailsOf(page);
  const drawer = drawerOf(page);

  // A lifted card, then Enter on Details: Details opens and the card drops.
  await enterOn(chip);
  await expect(liftedCard(page)).toHaveCount(1);
  await enterOn(detailsButton(page));
  await expect(details).toBeVisible();
  await expect(liftedCard(page)).toHaveCount(0);

  // Details open, then Enter on a chip: the card lifts and Details closes.
  await enterOn(chip);
  await expect(liftedCard(page)).toHaveCount(1);
  await expect(details).toBeHidden();

  // A lifted card, then Enter on the ticker: the log opens and the card drops.
  await enterOn(page.getByTestId("ticker"));
  await expect(drawer).toBeVisible();
  await expect(liftedCard(page)).toHaveCount(0);

  // The log open, then Enter on Details: Details opens and the log closes.
  await enterOn(detailsButton(page));
  await expect(details).toBeVisible();
  await expect(drawer).toBeHidden();

  // So Escape closes the one thing open, and nothing else is left behind it.
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(drawer).toBeHidden();
  await expect(liftedCard(page)).toHaveCount(0);
});

test("with Details over a pinned log, the ticker brings the log to the front and keeps it pinned", async ({ page }) => {
  const large = sizesFor(page).filter(isLarge);
  for (const size of large.length > 0 ? large : [LARGE_MONITOR]) {
    await page.setViewportSize(size);
    await startSixRegionGame(page);
    const drawer = drawerOf(page);
    const details = detailsOf(page);
    await page.getByTestId("ticker").click();
    await pinOf(page).click();
    await expect(pinOf(page)).toHaveText("Unpin");

    // By touch: Details over the pinned log, then the ticker.
    await detailsButton(page).click();
    await expect(details).toBeVisible();
    await page.getByTestId("ticker").click();
    await expect(details).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(pinOf(page)).toHaveText("Unpin");
    await expect(page.getByTestId("ticker")).toHaveAttribute("aria-expanded", "true");

    // By keyboard: the same.
    await enterOn(detailsButton(page));
    await expect(details).toBeVisible();
    await enterOn(page.getByTestId("ticker"));
    await expect(details).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(pinOf(page)).toHaveText("Unpin");

    // With nothing over it, the ticker still closes the pinned log, as before.
    await page.getByTestId("ticker").click();
    await expect(drawer).toBeHidden();
  }
});
