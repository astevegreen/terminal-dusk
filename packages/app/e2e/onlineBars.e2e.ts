// The Online and Watch screens' top bars (L10, #490), measured without the online stack on a test page (bars/) that
// draws the real OnlineGameView and WatchView from a real six-region frame. Their page lines (Back, the turn and
// deadline lines, "Watching" and who it waits for) share the one-line top bar with the status, the Details button
// and the ticker (L9, #489). At 844x390, 1280x800 and 1920x1080 everything stays inside the bar: the bar stays slim,
// Back, Details and the ticker stay whole tap targets, the ticker keeps its least width at the right end, and the
// turn line and the status's state text are never cut. A long deadline line may give way with "…".
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { box, expectNoPageScroll, expectTapTargets } from "./measure.ts";
import { sizesFor } from "./sizes.ts";

/** Whether an element's text shows in full: not cut short itself, nor by the box it sits in (the top bar, or the
 *  status line's own part of it), and wholly inside the screen's width. */
const whole = (page: Page, selector: string): Promise<boolean> =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const clip = (el.closest(".game-top-main") ?? el.closest(".game-top")!).getBoundingClientRect();
    return (
      el.scrollWidth <= el.clientWidth + 0.5 &&
      r.left >= clip.left - 0.5 &&
      r.right <= clip.right + 0.5 &&
      r.right <= window.innerWidth + 0.5
    );
  });

/** The top bar's items that stick out of it, by their text. */
const outsideTheBar = (page: Page): Promise<string[]> =>
  page.locator(".game-top").evaluate((bar) => {
    const b = bar.getBoundingClientRect();
    return [...bar.children]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.right > window.innerWidth + 0.5;
      })
      .map((el) => el.textContent ?? "");
  });

for (const view of ["online-mine", "online-rival", "watch"]) {
  test(`${view}: the page's lines share the top bar without pushing anything off it`, async ({ page }) => {
    for (const size of sizesFor(page)) {
      await page.setViewportSize(size);
      await page.goto(`/e2e/bars/index.html?view=${view}`);
      const top = page.locator(".game-top");
      await expect(top.getByRole("button", { name: "Back" })).toBeVisible();
      await expectNoPageScroll(page);

      const bar = await box(top);
      expect(bar.height, `${size.width}`).toBeLessThanOrEqual(size.height * 0.12);
      expect(await outsideTheBar(page), `${size.width}`).toEqual([]);
      const ticker = await box(top.getByTestId("ticker"));
      expect(ticker.width, `${size.width}`).toBeGreaterThanOrEqual(160);
      expect(ticker.height).toBeGreaterThanOrEqual(44);
      expect(ticker.right).toBeGreaterThanOrEqual(size.width - 8);
      await expect(top.getByRole("button", { name: "Details" })).toBeInViewport({ ratio: 1 });
      await expect(top.getByRole("button", { name: "Back" })).toBeInViewport({ ratio: 1 });
      await expectTapTargets(page);

      // The page's own turn line (its role="status") and the status line's state text show in full.
      expect(await whole(page, '.game-top > p[role="status"]'), `${size.width} turn line`).toBe(true);
      expect(await whole(page, '[data-testid="status-bar"] [role="status"]'), `${size.width} state`).toBe(true);
      if (view === "watch") expect(await whole(page, ".game-top > p:not([role])"), `${size.width} Watching`).toBe(true);
      else await expect(top.getByText(/left, then one extra deadline$/)).toBeAttached();
    }
  });
}
