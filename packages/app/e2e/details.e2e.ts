// The Details panel (L10, #490; docs/design/screen-layout.md), at 844x390, 1280x800 and 1920x1080 (sizes.ts). The
// sheet is gone: what its Details tab showed (the rival's hand size, the cards in play, the discard pile and the
// three Contingency decks) is one tap away, on the Details button in the top bar, with no page scroll and nothing
// to scroll inside the panel. One thing is open at a time: the panel, the log drawer and a lifted card each close
// when another opens. A screenshot of the open panel at each size is saved in the test's output folder.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { liftedCard, stripChips } from "./answer.ts";
import { box, expectNoPageScroll, expectTapTargets, shoot } from "./measure.ts";
import { sizesFor } from "./sizes.ts";
import { startSixRegionGame } from "./start.ts";

const OLD_DETAILS_TAB = ["opponent", "table", "contingency"];
const detailsButton = (page: Page): Locator => page.locator(".game-top").getByRole("button", { name: "Details" });
const panelOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game details", includeHidden: true });
const drawerOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game log", includeHidden: true });

/** Each part of the old Details tab shows in full: inside the screen, and inside the panel's own box, unscrolled. */
async function expectAllShown(page: Page): Promise<void> {
  const panel = panelOf(page);
  const body = panel.locator(".game-details-body");
  const [scrollHeight, clientHeight] = await body.evaluate((el) => [el.scrollHeight, el.clientHeight] as const);
  expect(scrollHeight, "nothing to scroll inside the panel").toBeLessThanOrEqual(clientHeight + 1);
  const inside = await box(body);
  for (const id of OLD_DETAILS_TAB) {
    const part = page.getByTestId(id);
    await expect(part, id).toBeInViewport({ ratio: 1 });
    const b = await box(part);
    expect(b.top, id).toBeGreaterThanOrEqual(inside.top - 0.5);
    expect(b.bottom, id).toBeLessThanOrEqual(inside.bottom + 0.5);
  }
  // The rival's hand is a number only, as it was in the tab.
  await expect(page.getByTestId("opponent")).toHaveText(/^SAE holds \d+ cards$/);
  await expect(page.getByTestId("table")).toContainText("In play:");
  await expect(page.getByTestId("table")).toContainText("Discard pile:");
  for (const deck of ["LIO:", "SAE:", "World:"]) await expect(page.getByTestId("contingency")).toContainText(deck);
}

test("one tap on Details shows everything the old Details tab showed, at every size, with no page scroll", async ({
  page,
}, testInfo) => {
  for (const size of sizesFor(page)) {
    await page.setViewportSize(size);
    await startSixRegionGame(page);
    await expect(page.getByRole("tab")).toHaveCount(0);
    const panel = panelOf(page);
    await expect(panel).toBeHidden();
    const button = await box(detailsButton(page));
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.bottom).toBeLessThanOrEqual((await box(page.locator(".game-top"))).bottom + 0.5);

    // One tap.
    await detailsButton(page).click();
    await expect(panel).toBeVisible();
    await expect(detailsButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => Math.round((await box(panel)).right)).toBe(size.width);
    await expectAllShown(page);
    await expectNoPageScroll(page);
    // About half the width at most, on the right, between the top bar and the decision banner, which stays in sight.
    const p = await box(panel);
    expect(p.left).toBeGreaterThanOrEqual(size.width * 0.4);
    expect(p.top).toBeGreaterThanOrEqual((await box(page.locator(".game-top"))).bottom - 1);
    expect(p.bottom).toBeLessThanOrEqual((await box(page.getByTestId("decision"))).top + 0.5);
    await expect(page.getByTestId("decision")).toBeInViewport({ ratio: 1 });
    await expectTapTargets(page);
    await shoot(page, testInfo, "l10", "details");
  }
});

test("in a game with no map, the Details panel still shows everything in full", async ({ page }) => {
  for (const size of sizesFor(page)) {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: "Play against the AI" }).click();
    await page.getByRole("button", { name: "Play as LIO" }).click();
    await expect(page.getByTestId("map-area")).toContainText("No map in this game");
    await detailsButton(page).click();
    await expectAllShown(page);
    await expectNoPageScroll(page);
    // The decision banner stays in sight below the panel.
    expect((await box(panelOf(page))).bottom).toBeLessThanOrEqual((await box(page.getByTestId("decision"))).top + 0.5);
  }
});

test("one thing open at a time: the Details panel, the log drawer and a lifted card each close when another opens", async ({
  page,
}) => {
  await startSixRegionGame(page);
  const panel = panelOf(page);
  const drawer = drawerOf(page);

  await detailsButton(page).click();
  await expect(panel).toBeVisible();
  // The ticker opens the log in its place.
  await page.getByTestId("ticker").click();
  await expect(drawer).toBeVisible();
  await expect(panel).toBeHidden();
  // Details opens the panel in the log's place.
  await detailsButton(page).click();
  await expect(panel).toBeVisible();
  await expect(drawer).toBeHidden();
  // A card lifted from the strip closes the panel...
  await stripChips(page).first().click();
  await expect(liftedCard(page)).toHaveCount(1);
  await expect(panel).toBeHidden();
  // ...and opening the panel drops the card.
  await detailsButton(page).click();
  await expect(panel).toBeVisible();
  await expect(liftedCard(page)).toHaveCount(0);
  // A second tap on Details closes it, and a tap outside it does too.
  await detailsButton(page).click();
  await expect(panel).toBeHidden();
  await detailsButton(page).click();
  await page.getByTestId("status-bar").click();
  await expect(panel).toBeHidden();
});
