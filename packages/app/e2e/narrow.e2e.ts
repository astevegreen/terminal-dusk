// The game screen on a phone held upright (375x667), found in the phase 3 gate playtest of 28 Oct: a game with no
// map kept a full-size empty map box (#412). Since L1 (#464) an upright phone shows the sideways layout under a
// short "turn your phone sideways" hint, instead of #412's one column.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el) => el.getBoundingClientRect().toJSON());

async function startVsAi(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  await expect(page.getByTestId("map-area")).toContainText("No map in this game");
}

test("at this project's size, a game with no map gives its map box only a line", async ({ page }) => {
  await startVsAi(page);
  expect((await box(page.getByTestId("map-area"))).height).toBeLessThanOrEqual(40);
});

/** The hand shows every card in full: its box does not scroll inside itself (#416). */
async function expectHandUnscrolled(page: Page): Promise<void> {
  const hand = page.getByTestId("hand");
  await expect(hand).toBeVisible();
  const [scrollHeight, clientHeight] = await hand.evaluate((el) => [el.scrollHeight, el.clientHeight] as const);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
}

test("against the AI: the whole hand shows, with no scroll inside the hand box", async ({ page }) => {
  await startVsAi(page);
  await expectHandUnscrolled(page);
});

test.describe("on a phone held upright", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  /**
   * The same sideways layout under a short turn-your-phone hint (L1, #464): no page scroll either way, the hint
   * above the status bar, the status bar, map and decision on screen, and the map beside the side panel (or, with
   * no map, its one line above the panel, which then takes the whole width).
   */
  async function checkUpright(page: Page, hasMap: boolean): Promise<void> {
    const fits = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight,
    );
    expect(fits).toBe(true);
    const hint = page.getByText("Turn your phone sideways to play.");
    await expect(hint).toBeVisible();
    expect((await box(hint)).bottom).toBeLessThanOrEqual((await box(page.getByTestId("status-bar"))).top);
    for (const id of ["status-bar", "map-area", "decision"]) await expect(page.getByTestId(id)).toBeInViewport();
    const side = await box(page.getByRole("region", { name: "Game details" }));
    const map = await box(page.getByTestId("map-area"));
    if (hasMap) expect(side.left).toBeGreaterThanOrEqual(map.right);
    else expect(side.top).toBeGreaterThanOrEqual(map.bottom);
  }

  test("test mode: the hint above the same layout, and the map keeps room for itself", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Test mode" }).click();
    await expect(page.getByTestId("decision")).toBeVisible();
    await checkUpright(page, true);
    await expectHandUnscrolled(page);
    expect((await box(page.getByTestId("map-area"))).height).toBeGreaterThanOrEqual(150);
  });

  test("against the AI: the hint above the same layout, and the map box with no map takes only a line", async ({
    page,
  }) => {
    await startVsAi(page);
    await checkUpright(page, false);
    await expectHandUnscrolled(page);
    expect((await box(page.getByTestId("map-area"))).height).toBeLessThanOrEqual(40);
  });
});
