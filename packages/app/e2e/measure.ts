// Shared measurements for the Playwright smoke tests of the map-first screen (not a test file: only *.e2e.ts files
// are tests). Moved here from landscape.e2e.ts when L10 (#490) needed them too.
import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { pageSize } from "./start.ts";

export const box = (locator: Locator): Promise<DOMRect> =>
  locator.evaluate((el) => el.getBoundingClientRect().toJSON());

export async function expectNoPageScroll(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  const size = await pageSize(page);
  expect(size.height).toBeLessThanOrEqual(viewport.height);
  expect(size.width).toBeLessThanOrEqual(viewport.width);
}

/** The alpha of an element's background colour: below 1 means the map shows through it. */
export const backgroundAlpha = (locator: Locator): Promise<number> =>
  locator.evaluate((el) => {
    const parts = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor)?.[1]?.split(/[\s,/]+/) ?? [];
    return parts.length === 4 ? Number(parts[3]) : 1;
  });

/** The map's countries and region names covered by something outside the map: a country at its marker's centre, a
 *  region at its name's first and last letters. */
export const coveredOnMap = (page: Page): Promise<string[]> =>
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

/** Every visible button and menu is at least a tap target (44 px) tall. */
export async function expectTapTargets(page: Page): Promise<void> {
  const heights = await page
    .locator("button:visible, summary:visible")
    .evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
}

/** Saves a screenshot of the page in the test's output folder as `<prefix>-<name>-<width>.png` and attaches it. */
export async function shoot(page: Page, testInfo: TestInfo, prefix: string, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`${prefix}-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}
