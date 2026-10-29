// The ticker, the log drawer and the pulse (L9, #489), run at both configured sizes (844x390 and 1280x800) in the
// six-region game against the AI. After the AI moves, the ticker, at the top bar's right end (Decision (architect)
// on #489: no row of its own, so the map keeps every pixel), shows its newest log line and the
// countries its move touched pulse, or, with reduced motion, keep a steady outline. The ticker opens the full log
// in a drawer on the right, which closes on a tap outside, on Close and on Escape, by touch and by keyboard.
// Screenshots of the ticker with a pulse and of the open drawer are saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";
import { startSixRegionGame } from "./start.ts";

const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el) => el.getBoundingClientRect().toJSON());
const tickerOf = (page: Page): Locator => page.getByTestId("ticker");
const drawerOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game log", includeHidden: true });
const newestLogLine = (page: Page): Promise<string | null> =>
  page.getByTestId("log").locator("li").first().textContent();

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l9-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}

/** What the screen showed at one moment while SAE's line was on the ticker and some countries were touched. */
type Seen = {
  ticker: string;
  newest: string;
  log: string;
  touched: { id: string; animation: string; outline: string; width: string }[];
};

/**
 * Watches every change the page draws, as the AI's moves go by faster than a test can look, and keeps each moment
 * when the ticker shows a line of SAE's and some countries are marked as touched.
 */
async function watchTheAi(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: Seen[] = [];
    (window as unknown as { l9Seen: Seen[] }).l9Seen = seen;
    const look = (): void => {
      const ticker = document.querySelector(".game-ticker-line")?.textContent ?? "";
      const touched = [...document.querySelectorAll<HTMLElement>('.dm-marker[data-touched="true"]')].map((el) => {
        const s = getComputedStyle(el);
        return {
          id: el.dataset["country"]!,
          animation: s.animationName,
          outline: s.outlineStyle,
          width: s.outlineWidth,
        };
      });
      if (!ticker.startsWith("SAE ") || touched.length === 0) return;
      const log = document.querySelector('[data-testid="log"]');
      const newest = log?.querySelector("li")?.textContent ?? "";
      seen.push({ ticker, newest, log: log?.textContent ?? "", touched });
    };
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
}

/** Plays LIO until the AI has been seen moving on the map, and returns what the screen showed then. */
async function untilTheAiMoved(page: Page): Promise<Seen> {
  await watchTheAi(page);
  const seen = (): Promise<Seen[]> => page.evaluate(() => (window as unknown as { l9Seen: Seen[] }).l9Seen);
  const over = page.getByText("Game over");
  for (let step = 0; step < 150; step++) {
    await yourDecision(page).or(over).first().waitFor();
    const found = await seen();
    if (found.length > 0) return found.at(-1)!;
    if (await over.isVisible()) break;
    await answerOnce(page);
  }
  throw new Error("the AI was never seen moving on the map");
}

test("after the AI moves, the ticker shows its log line and the countries it touched pulse", async ({
  page,
}, testInfo) => {
  await startSixRegionGame(page);
  const seen = await untilTheAiMoved(page);

  // The ticker showed the log's newest line, word for word.
  expect(seen.ticker).toBe(seen.newest);
  // Each touched country pulsed, and each is named in the log, so the pulse follows the moves the log tells.
  for (const marker of seen.touched) {
    expect(marker.animation, marker.id).toMatch(/^dm-pulse-[01]$/);
    expect(seen.log).toContain(marker.id);
  }
  // And now, on LIO's turn, the ticker still shows the log's newest line.
  await expect(tickerOf(page).locator(".game-ticker-line")).toHaveText((await newestLogLine(page))!);
  await shoot(page, testInfo, "ticker-pulse");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the countries the AI touched get a steady outline instead of a pulse", async ({ page }) => {
    await startSixRegionGame(page);
    const seen = await untilTheAiMoved(page);
    for (const marker of seen.touched) {
      expect(marker, marker.id).toEqual({ id: marker.id, animation: "none", outline: "solid", width: "5px" });
    }
  });
});

test("the ticker sits at the top bar's right end, see-through and a tap target tall, and opens the drawer on the right", async ({
  page,
}, testInfo) => {
  await startSixRegionGame(page);
  const viewport = page.viewportSize()!;
  const ticker = tickerOf(page);
  const top = await box(page.locator(".game-top"));
  const tickerBox = await box(ticker);
  // Inside the top bar, which stays slim (at most 12% of the height), so the map loses nothing to it.
  await expect(page.locator(".game-top").getByTestId("ticker")).toBeVisible();
  expect(top.height).toBeLessThanOrEqual(viewport.height * 0.12);
  expect(tickerBox.top).toBeGreaterThanOrEqual(top.top);
  expect(tickerBox.bottom).toBeLessThanOrEqual(top.bottom);
  expect(tickerBox.right).toBeGreaterThanOrEqual(viewport.width - 8);
  expect(tickerBox.height).toBeGreaterThanOrEqual(44);
  expect(tickerBox.width).toBeGreaterThanOrEqual(160);
  // The status line's own state text stays in full beside it.
  await expect(page.getByTestId("status-bar").getByRole("status")).toBeInViewport({ ratio: 1 });
  const statusShown = await page
    .getByTestId("status-bar")
    .getByRole("status")
    .evaluate((el) => {
      const s = el.getBoundingClientRect();
      const bar = el.closest(".game-top-main")!.getBoundingClientRect();
      return s.right <= bar.right + 0.5 && el.scrollWidth <= el.clientWidth;
    });
  expect(statusShown).toBe(true);
  const alpha = await ticker.evaluate((el) => {
    const parts = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor)?.[1]?.split(/[\s,/]+/) ?? [];
    return parts.length === 4 ? Number(parts[3]) : 1;
  });
  expect(alpha).toBeLessThan(1);
  await expect(drawerOf(page)).toBeHidden();
  await expect(ticker).toHaveAttribute("aria-expanded", "false");

  await ticker.click();
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  await expect(ticker).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("log", { name: "Log" })).toBeVisible();
  // About half the width, on the right, under the ticker: the left half of the map stays in sight. It slides in,
  // so it is measured once it has arrived, and the game has not moved sideways to show it.
  await expect.poll(async () => Math.round((await box(drawer)).right)).toBe(viewport.width);
  const drawerBox = await box(drawer);
  expect((await box(page.locator(".game"))).left).toBe(0);
  expect(await page.locator(".game").evaluate((el) => el.scrollLeft)).toBe(0);
  expect(drawerBox.left).toBeGreaterThanOrEqual(viewport.width * 0.4);
  expect(drawerBox.top).toBeGreaterThanOrEqual(tickerBox.bottom - 1);
  const heights = await page
    .locator("button:visible, summary:visible")
    .evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  await shoot(page, testInfo, "drawer");
});

test.describe("by touch", () => {
  test.use({ hasTouch: true });

  test("the drawer opens from the ticker and closes on a tap outside it or on Close", async ({ page }) => {
    await startSixRegionGame(page);
    const ticker = tickerOf(page);
    const drawer = drawerOf(page);

    await ticker.tap();
    await expect(drawer).toBeVisible();
    // A tap inside the drawer keeps it open.
    await drawer.getByRole("log").tap();
    await expect(drawer).toBeVisible();
    // A tap outside, here on the top bar's status, closes it.
    await page.getByTestId("status-bar").tap();
    await expect(drawer).toBeHidden();
    await expect(ticker).toHaveAttribute("aria-expanded", "false");

    await ticker.tap();
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).tap();
    await expect(drawer).toBeHidden();

    // A tap on the ticker while the drawer is open closes it too.
    await ticker.tap();
    await expect(drawer).toBeVisible();
    await ticker.tap();
    await expect(drawer).toBeHidden();
  });
});

test("by keyboard, the drawer opens from the ticker, takes the keyboard, and Escape closes it back to the ticker", async ({
  page,
}) => {
  await startSixRegionGame(page);
  const ticker = tickerOf(page);
  const drawer = drawerOf(page);

  await ticker.focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeVisible();
  await expect(drawer).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(ticker).toBeFocused();

  // Space opens it too, and Close puts the keyboard back on the ticker.
  await page.keyboard.press("Space");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).press("Enter");
  await expect(drawer).toBeHidden();
  await expect(ticker).toBeFocused();
});
