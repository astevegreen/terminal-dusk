// The map-first game screen (L5, #485), run at both configured sizes (844x390 and 1280x800): the map fills the
// whole game screen and everything else floats over it. A slim see-through top bar with the ticker at its right end
// (L9, #489), the decision banner just above the hand strip (L7, #487), a sheet along the bottom with the Details
// tab that starts folded down to its tab row, and "Whole map" keeps every country clear of all of them. A screenshot
// of each size, sheet open and folded, is saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { pageSize, startSixRegionGame } from "./start.ts";

const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el) => el.getBoundingClientRect().toJSON());
const tab = (page: Page, name: string): Locator => page.getByRole("tab", { name, exact: true });
const sheetOf = (page: Page): Locator => page.getByRole("region", { name: "Game details" });

async function expectNoPageScroll(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  const size = await pageSize(page);
  expect(size.height).toBeLessThanOrEqual(viewport.height);
  expect(size.width).toBeLessThanOrEqual(viewport.width);
}

/** The alpha of an element's background colour: below 1 means the map shows through it. */
const backgroundAlpha = (locator: Locator): Promise<number> =>
  locator.evaluate((el) => {
    const parts = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor)?.[1]?.split(/[\s,/]+/) ?? [];
    return parts.length === 4 ? Number(parts[3]) : 1;
  });

/** The map's countries and region names covered by something outside the map: a country at its marker's centre, a
 *  region at its name's first and last letters. */
const coveredOnMap = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const view = document.querySelector(".dm-view")!;
    const shown = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && view.contains(hit);
    };
    const covered: string[] = [];
    for (const el of document.querySelectorAll(".dm-marker")) {
      const r = el.getBoundingClientRect();
      if (!shown(r.left + r.width / 2, r.top + r.height / 2)) covered.push(el.textContent ?? "");
    }
    for (const el of document.querySelectorAll(".dm-region")) {
      const name = document.createRange();
      name.selectNodeContents(el);
      const r = name.getClientRects()[0]!;
      const y = r.top + r.height / 2;
      if (!shown(r.left + 2, y) || !shown(r.right - 2, y)) covered.push(el.textContent ?? "");
    }
    return covered;
  });

/** Map, List and Whole map are each what a tap at their centre lands on: nothing, the open sheet included, covers
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

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l5-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}

test("the map fills the game screen, with a slim see-through top bar and a sheet along the bottom", async ({
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
  // #487), and the sheet stays folded, so nothing else covers the map.
  const sheet = sheetOf(page);
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  const banner = page.getByTestId("decision");
  await expect(banner.getByRole("group").first()).toBeInViewport({ ratio: 1 });
  const bannerBox = await box(banner);
  expect(bannerBox.height).toBeLessThanOrEqual(viewport.height * 0.13);
  expect(bannerBox.bottom).toBeCloseTo((await box(page.getByTestId("hand"))).top, 0);
  expect(await backgroundAlpha(banner)).toBeLessThan(1);
  // The hand strip is on screen too, whose cards carry a card decision's choices (L6).
  await expect(page.getByTestId("hand").getByRole("toolbar").getByRole("button").first()).toBeInViewport({
    ratio: 1,
  });
  // A tab opens the sheet: its panel rises over the map but leaves the top 40% clear.
  await tab(page, "Details").click();
  const panel = await box(page.getByRole("tabpanel"));
  expect(panel.top).toBeGreaterThanOrEqual(mapBox.top + mapBox.height * 0.4);
  expect((await box(sheet)).bottom).toBeCloseTo(mapBox.bottom, 0);
  await expectToolsTappable(map);

  // Every button and menu on screen, the tabs, Hide and the map tools included, is at least a tap target tall.
  const heights = await page
    .locator("button:visible, summary:visible")
    .evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  await shoot(page, testInfo, "open");

  // Hide folds the sheet to its tab row: at most 15% of the height, see-through, and no panel shows.
  await sheet.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  const folded = await box(sheet);
  expect(folded.height).toBeLessThanOrEqual(viewport.height * 0.15);
  expect(folded.bottom).toBeCloseTo(mapBox.bottom, 0);
  expect(await backgroundAlpha(sheet.getByRole("tablist").locator(".."))).toBeLessThan(1);

  // "Whole map" fits the world between the top bar and the banner: no country or region name is covered.
  await map.getByRole("button", { name: "Whole map" }).click();
  expect((await box(map.locator(".dm-view"))).bottom).toBeLessThanOrEqual(bannerBox.top + 0.5);
  await expect.poll(() => coveredOnMap(page)).toEqual([]);
  await expectNoPageScroll(page);
  await shoot(page, testInfo, "folded");

  // The tab opens the sheet again.
  await tab(page, "Details").click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
});

test("the sheet's Details tab opens it, Hide folds it, and a new decision folds it again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  const decision = page.getByTestId("decision");
  await expect(decision).toBeVisible();
  // The decision is the banner above the hand strip (L7, #487) and the log is in the drawer the ticker opens (L9,
  // #489), so Details is the one tab, and the sheet starts folded.
  expect(await page.getByRole("tab").allTextContents()).toEqual(["Details"]);
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "false");
  await expect(page.getByTestId("hand")).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();

  await tab(page, "Details").click();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  for (const id of ["opponent", "table", "contingency"]) await expect(page.getByTestId(id)).toBeVisible();
  // Test mode's own controls above the game leave it shorter, and the open sheet still leaves the map tools clear.
  await expectToolsTappable(page.getByTestId("map-area"));
  await expectNoPageScroll(page);

  // Hide folds the sheet: no tab is picked and nothing in it shows; Hide itself goes until it opens again. The
  // banner and the hand strip are not in the sheet: they stay.
  const hide = sheetOf(page).getByRole("button", { name: "Hide" });
  await hide.click();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "false");
  for (const id of ["log", "contingency"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(hide).toBeHidden();
  await expect(decision).toBeVisible();
  await expect(page.getByTestId("hand")).toBeVisible();

  // Another tab opens it again, and Hide folds it again, from the keyboard too: the keyboard's place moves to the
  // tab that was open, as Hide itself goes.
  await tab(page, "Details").click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await hide.press("Enter");
  await expect(page.getByTestId("contingency")).toBeHidden();
  await expect(tab(page, "Details")).toBeFocused();

  // Left open on Details, the sheet folds by itself when SAE's opening pick arrives as a new decision.
  await tab(page, "Details").click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await page.getByRole("button", { name: "SAE", exact: true }).click();
  await expect(decision.getByText("SAE: pick an opening card")).toBeVisible();
  await expect(page.getByTestId("contingency")).toBeHidden();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
});
