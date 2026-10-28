// The game screen on a phone held upright (375x667), found in the phase 3 gate playtest of 28 Oct: the details
// column and the log were squeezed, and a game with no map kept a full-size empty map box (#412).
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

  /** One column, top to bottom: status, map, hand, then the details; the log and map each nearly full width. */
  async function checkUpright(page: Page): Promise<void> {
    const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noSideScroll).toBe(true);
    expect((await box(page.getByTestId("log"))).width).toBeGreaterThanOrEqual(340);
    expect((await box(page.getByTestId("map-area"))).width).toBeGreaterThanOrEqual(340);
    const order = [
      page.getByTestId("status-bar"),
      page.getByTestId("map-area"),
      page.getByTestId("hand"),
      page.getByRole("region", { name: "Game details" }),
    ];
    const tops = await Promise.all(order.map(async (region) => (await box(region)).top));
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1] ?? 0);
  }

  test("test mode: one column, the map keeps room for itself", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Test mode" }).click();
    await expect(page.getByTestId("decision")).toBeVisible();
    await checkUpright(page);
    await expectHandUnscrolled(page);
    expect((await box(page.getByTestId("map-area"))).height).toBeGreaterThanOrEqual(150);
  });

  test("against the AI: one column, and the map box with no map takes only a line", async ({ page }) => {
    await startVsAi(page);
    await checkUpright(page);
    await expectHandUnscrolled(page);
    expect((await box(page.getByTestId("map-area"))).height).toBeLessThanOrEqual(40);
  });
});
