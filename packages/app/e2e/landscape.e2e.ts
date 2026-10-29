// The map-first game screen (L5, #485), run at both configured sizes (844x390 and 1280x800): the map fills the
// whole game screen and everything else floats over it. A slim see-through top bar, a sheet along the bottom with
// the Play, Log and Details tabs that folds down to its tab row, and "Whole map" keeps every country clear of
// both. A screenshot of each size, sheet open and folded, is saved in the test's output folder and attached.
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

  // A decision waits, so the sheet is open on Play: its panel rises over the map but leaves the top 40% clear.
  const sheet = sheetOf(page);
  await expect(tab(page, "Play")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("decision").getByRole("button").first()).toBeInViewport({ ratio: 1 });
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

  // "Whole map" fits the world between the top bar and the folded sheet: no country or region name is covered.
  await map.getByRole("button", { name: "Whole map" }).click();
  await expect.poll(() => coveredOnMap(page)).toEqual([]);
  await expectNoPageScroll(page);
  await shoot(page, testInfo, "folded");

  // Each tab opens the sheet again.
  await tab(page, "Log").click();
  await expect(page.getByTestId("log")).toBeVisible();
  await expect(tab(page, "Log")).toHaveAttribute("aria-selected", "true");
});

test("the sheet's tabs switch between Play, Log and Details, Hide folds it, and a new decision opens Play", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  const decision = page.getByTestId("decision");
  await expect(decision).toBeVisible();
  await expect(tab(page, "Play")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("hand")).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();
  // Test mode's own controls above the game leave it shorter, and the open sheet still leaves the map tools clear.
  await expectToolsTappable(page.getByTestId("map-area"));

  await tab(page, "Log").click();
  await expect(tab(page, "Log")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("log")).toBeVisible();
  await expect(decision).toBeHidden();

  await tab(page, "Details").click();
  for (const id of ["opponent", "table", "contingency"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();
  await expectNoPageScroll(page);

  // Hide folds the sheet: no tab is picked and nothing in it shows; Hide itself goes until it opens again.
  const hide = sheetOf(page).getByRole("button", { name: "Hide" });
  await hide.click();
  for (const name of ["Play", "Log", "Details"])
    await expect(tab(page, name)).toHaveAttribute("aria-selected", "false");
  for (const id of ["decision", "hand", "log", "contingency"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(hide).toBeHidden();

  // A tab opens it again, and Hide folds it again.
  await tab(page, "Details").click();
  await expect(page.getByTestId("contingency")).toBeVisible();
  await hide.click();
  await expect(page.getByTestId("contingency")).toBeHidden();

  // SAE's opening pick is a new decision on screen, so the sheet opens on Play by itself.
  await page.getByRole("button", { name: "SAE", exact: true }).click();
  await expect(tab(page, "Play")).toHaveAttribute("aria-selected", "true");
  await expect(decision.getByRole("button").first()).toBeVisible();
  await expect(page.getByTestId("contingency")).toBeHidden();
});
