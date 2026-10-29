// The map-first game screen (L5, #485), run at both configured sizes (844x390 and 1280x800): the map fills the
// whole game screen and everything else floats over it. A slim see-through top bar with the Details button and the
// ticker at its right end (L9, #489; L10, #490), the decision banner just above the hand strip (L7, #487), and
// "Whole map" keeps every country clear of all of them. The sheet that sat along the bottom is gone since L10: what
// its Details tab held is the Details panel the top bar's button opens. A screenshot of each size, panel open and
// closed, is saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { backgroundAlpha, box, coveredOnMap, expectNoPageScroll, expectTapTargets, shoot } from "./measure.ts";
import { startSixRegionGame } from "./start.ts";

const detailsButton = (page: Page): Locator => page.locator(".game-top").getByRole("button", { name: "Details" });
const panelOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game details", includeHidden: true });

/** Map, List and Whole map are each what a tap at their centre lands on: nothing, the open panel included, covers
 *  them. */
async function expectToolsTappable(map: Locator): Promise<void> {
  for (const name of ["Map", "List", "Whole map"]) {
    const tappable = await map.getByRole("button", { name, exact: true }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && el.contains(hit);
    });
    expect(tappable, name).toBe(true);
  }
}

test("the map fills the game screen, with a slim see-through top bar, and Details opens a panel over it", async ({
  page,
}, testInfo) => {
  const map = await startSixRegionGame(page);
  const viewport = page.viewportSize()!;
  await expectNoPageScroll(page);
  // Held sideways, the turn-your-phone hint stays out of the way.
  await expect(page.getByText("Turn your phone sideways to play.")).toBeHidden();

  // The map area is the whole screen, edge to edge: nothing of the page sits above or beside the game.
  const mapBox = await box(map);
  expect(mapBox.left).toBeCloseTo(0, 0);
  expect(mapBox.top).toBeCloseTo(0, 0);
  expect(mapBox.width).toBeCloseTo(viewport.width, 0);
  expect(mapBox.height).toBeCloseTo(viewport.height, 0);

  // The top bar lies over the map's top edge: at most 12% of the height, see-through, holding the status, the
  // score track and Escalation.
  const topBar = page.locator(".game-top");
  const top = await box(topBar);
  expect(top.top).toBeCloseTo(mapBox.top, 0);
  expect(top.height).toBeLessThanOrEqual(viewport.height * 0.12);
  expect(await backgroundAlpha(topBar)).toBeLessThan(1);
  await expect(page.getByTestId("status-bar")).toBeInViewport({ ratio: 1 });
  await expect(topBar.getByTestId("status-bar")).toBeVisible();
  await expect(topBar.getByTestId("tracks")).toBeVisible();

  // A decision waits: its question is in the banner, one slim see-through line just above the hand strip (L7,
  // #487), and no panel is open, so nothing else covers the map. No sheet or tab is left (L10, #490).
  const panel = panelOf(page);
  await expect(panel).toBeHidden();
  await expect(page.getByRole("tab")).toHaveCount(0);
  const banner = page.getByTestId("decision");
  await expect(banner.getByRole("group").first()).toBeInViewport({ ratio: 1 });
  const bannerBox = await box(banner);
  expect(bannerBox.height).toBeLessThanOrEqual(viewport.height * 0.13);
  expect(bannerBox.bottom).toBeCloseTo((await box(page.getByTestId("hand"))).top, 0);
  expect(await backgroundAlpha(banner)).toBeLessThan(1);
  // The hand strip is on screen too, whose cards carry a card decision's choices (L6), the whole width of the screen
  // now the sheet's tab row has left it.
  await expect(page.getByTestId("hand").getByRole("toolbar").getByRole("button").first()).toBeInViewport({
    ratio: 1,
  });
  const strip = await box(page.getByTestId("hand"));
  expect(strip.left).toBeCloseTo(0, 0);
  expect(strip.right).toBeCloseTo(viewport.width, 0);

  // Details opens its panel: it lies over the map between the top bar and the banner, on the right, and leaves the
  // map tools, the banner and the strip clear.
  await detailsButton(page).click();
  await expect(panel).toBeVisible();
  await expect.poll(async () => Math.round((await box(panel)).right)).toBe(viewport.width);
  const panelBox = await box(panel);
  expect(panelBox.top).toBeGreaterThanOrEqual(top.bottom - 1);
  expect(panelBox.bottom).toBeLessThanOrEqual(bannerBox.top + 0.5);
  await expectToolsTappable(map);

  // Every button and menu on screen, Details, the panel's Close and the map tools included, is a tap target tall.
  await expectTapTargets(page);
  await shoot(page, testInfo, "l10", "details-open");

  // Close shuts it, and no panel shows.
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();

  // "Whole map" fits the world between the top bar and the banner: no country or region name is covered.
  await map.getByRole("button", { name: "Whole map" }).click();
  expect((await box(map.locator(".dm-view"))).bottom).toBeLessThanOrEqual(bannerBox.top + 0.5);
  await expect.poll(() => coveredOnMap(page)).toEqual([]);
  await expectNoPageScroll(page);
  await shoot(page, testInfo, "l10", "whole-map");

  // Details opens it again.
  await detailsButton(page).click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await expect(detailsButton(page)).toHaveAttribute("aria-expanded", "true");
});

test("Details opens its panel, Close and Escape close it, and a new decision closes it again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  const decision = page.getByTestId("decision");
  await expect(decision).toBeVisible();
  // The decision is the banner above the hand strip (L7, #487), the log is in the drawer the ticker opens (L9,
  // #489), and the details are in the panel Details opens (L10, #490), which starts closed.
  await expect(page.getByRole("tab")).toHaveCount(0);
  const details = detailsButton(page);
  const panel = panelOf(page);
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await expect(page.getByTestId("hand")).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();

  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  for (const id of ["opponent", "table", "contingency"]) await expect(page.getByTestId(id)).toBeVisible();
  // Test mode's own controls above the game leave it shorter, and the open panel still leaves the map tools clear.
  await expectToolsTappable(page.getByTestId("map-area"));
  await expectNoPageScroll(page);

  // Close shuts it: nothing in it shows. The banner and the hand strip are not in it: they stay.
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(details).toHaveAttribute("aria-expanded", "false");
  for (const id of ["log", "contingency"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(decision).toBeVisible();
  await expect(page.getByTestId("hand")).toBeVisible();

  // From the keyboard: Enter opens it and the keyboard moves in; Escape, or Close, shuts it and the keyboard goes
  // back to Details.
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("contingency")).toBeVisible();
  await expect(panel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("contingency")).toBeHidden();
  await expect(details).toBeFocused();
  await page.keyboard.press("Enter");
  await panel.getByRole("button", { name: "Close" }).press("Enter");
  await expect(page.getByTestId("contingency")).toBeHidden();
  await expect(details).toBeFocused();

  // Left open, the panel closes by itself when SAE's opening pick arrives as a new decision. The switch is pressed by
  // keyboard, as a tap outside the panel would close it anyway.
  await details.click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await page.getByRole("button", { name: "SAE", exact: true }).press("Enter");
  await expect(decision.getByText("SAE: pick an opening card")).toBeVisible();
  await expect(page.getByTestId("contingency")).toBeHidden();
  await expect(panel).toBeHidden();
});
