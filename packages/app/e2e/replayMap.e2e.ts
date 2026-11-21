// The replay viewer on the map-first game screen (#493; docs/design/screen-layout.md), run at both configured sizes
// (844x390 and 1280x800). A finished six-region game against the AI is watched back: the drawn map fills the
// screen, the replay controls sit in the slim top bar, both hands are in the Details panel, and stepping forward
// changes the influence on the map and lights the countries that step touched. Screenshots are attached.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { box, expectNoPageScroll, expectTapTargets, shoot } from "./measure.ts";
import { playToGameOver } from "./finishGame.ts";
import { fixRandom } from "./start.ts";

/** Every country marker's text (its name and influence), so two steps' maps can be compared. */
const markers = (page: Page): Promise<string[]> =>
  page
    .getByTestId("map-area")
    .locator(".dm-marker")
    .evaluateAll((all) => all.map((el) => el.textContent ?? ""));

test("replay: the map fills the screen, the controls sit in the top bar, and a step lights what it touched", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await fixRandom(page, 1);
  await playToGameOver(page, "six-region");
  await page.getByRole("button", { name: "Watch replay" }).click();
  const step = page.getByText(/^Step \d+ of \d+$/);
  await expect(step).toHaveText(/^Step 1 of \d+$/);
  const total = Number(/of (\d+)$/.exec(await step.innerText())![1]);
  const viewport = page.viewportSize()!;

  // The map is the whole screen, edge to edge, and the page never scrolls.
  const map = page.getByTestId("map-area");
  await expect(map.locator(".dm-marker").first()).toBeVisible();
  const mapBox = await box(map);
  expect(mapBox.left).toBeCloseTo(0, 0);
  expect(mapBox.top).toBeCloseTo(0, 0);
  expect(mapBox.width).toBeCloseTo(viewport.width, 0);
  expect(mapBox.height).toBeCloseTo(viewport.height, 0);
  await expectNoPageScroll(page);

  // The controls are one landmark, in the top bar, which takes at most 12% of the height; the bottom edge (the
  // decision banner and the strip's counts) at most 15%.
  const topBar = page.locator(".game-top");
  await expect(page.getByRole("navigation", { name: "Replay controls" })).toHaveCount(1);
  await expect(topBar.getByRole("navigation", { name: "Replay controls" })).toBeVisible();
  await expect(topBar.getByTestId("status-bar")).toBeVisible();
  expect((await box(topBar)).height).toBeLessThanOrEqual(viewport.height * 0.12);
  const bottom = await box(page.locator(".game-bottom"));
  expect(viewport.height - bottom.top).toBeLessThanOrEqual(viewport.height * 0.15);
  await expectTapTargets(page);
  await shoot(page, testInfo, "replay", "first-step");

  // Forward to the first step that touched a country: it lights up, and the map's influence differs from the step
  // before.
  const touched = map.locator('.dm-marker[data-touched="true"]');
  let before = await markers(page);
  for (let k = 1; k < total && (await touched.count()) === 0; k++) {
    before = await markers(page);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(step).toHaveText(`Step ${k + 1} of ${total}`);
  }
  await expect(touched.first()).toBeVisible();
  expect(await markers(page)).not.toEqual(before);
  await shoot(page, testInfo, "replay", "touched");

  // Both hands are in the Details panel, which a tap on Details opens.
  await topBar.getByRole("button", { name: "Details" }).click();
  const details = page.getByRole("dialog", { name: "Game details" });
  await expect(details.getByText("LIO hand")).toBeVisible();
  await expect(details.getByText("SAE hand")).toBeVisible();
  await expectTapTargets(page);
  await expectNoPageScroll(page);
  await shoot(page, testInfo, "replay", "details-open");
  await details.getByRole("button", { name: "Close" }).click();

  // The last step: the seed check in the top bar, the page still unscrolled.
  await page.getByRole("button", { name: "Last" }).click();
  await expect(topBar.getByText(/^Seed checked: \S+/)).toBeVisible();
  await expectNoPageScroll(page);
  expect((await box(topBar)).height).toBeLessThanOrEqual(viewport.height * 0.12);
  await shoot(page, testInfo, "replay", "last-step");

  // The bar may cut the result short on a phone; the Details panel holds it and the seed check in full.
  await topBar.getByRole("button", { name: "Details" }).click();
  await expect(details.getByText(/^Game over: .+, .+$/)).toBeVisible();
  await expect(details.getByText(/^Seed checked: \S+$/)).toBeVisible();
  await expectNoPageScroll(page);
});
