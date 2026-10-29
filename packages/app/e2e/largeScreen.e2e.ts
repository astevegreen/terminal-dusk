// Large screens (L10, #490; docs/design/screen-layout.md): 1200 px wide and up get the same layout with more room.
// Run at 844x390, 1280x800 and 1920x1080 (sizes.ts). On a large screen the log drawer can be pinned open at the side,
// where it stays and leaves the middle of the map in sight, with "Whole map" fitting every country beside it; the
// hand strip shows bigger cards with their full names; and the text is larger. A phone held sideways has no Pin.
// Screenshots of the pinned log are saved in the test's output folder and attached.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { playFromStrip, stripChips } from "./answer.ts";
import { box, coveredOnMap, expectNoPageScroll, expectTapTargets, shoot } from "./measure.ts";
import { isLarge, sizesFor } from "./sizes.ts";
import { startSixRegionGame } from "./start.ts";

const CARDS = fileURLToPath(new URL("../../content/cards", import.meta.url));
const drawerOf = (page: Page): Locator => page.getByRole("dialog", { name: "Game log", includeHidden: true });
const pinOf = (page: Page): Locator => drawerOf(page).locator(".game-drawer-pin");

/** Whether a tap at the middle of the map area lands on the map itself, not on anything over it. */
const middleOfMapShown = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const area = document.querySelector('[data-testid="map-area"]')!.getBoundingClientRect();
    const hit = document.elementFromPoint(area.left + area.width / 2, area.top + area.height / 2);
    return hit !== null && document.querySelector(".dm-view")!.contains(hit);
  });

test("on a large screen the log can be pinned open at the side, leaving the middle of the map in sight", async ({
  page,
}, testInfo) => {
  for (const size of sizesFor(page)) {
    await page.setViewportSize(size);
    const map = await startSixRegionGame(page);
    const drawer = drawerOf(page);
    await page.getByTestId("ticker").click();
    await expect(drawer).toBeVisible();
    if (!isLarge(size)) {
      // A phone held sideways has no room to pin it: no Pin.
      await expect(pinOf(page)).toBeHidden();
      continue;
    }
    await expect(pinOf(page)).toHaveText("Pin");
    await expect(pinOf(page)).toHaveAttribute("aria-pressed", "false");
    await pinOf(page).click();
    await expect(pinOf(page)).toHaveText("Unpin");
    await expect(pinOf(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("ticker")).toHaveAttribute("aria-expanded", "true");

    // Pinned, it is narrower (at most about a quarter of the width, on the right), and the map fits itself beside
    // it: its middle is in sight, and at "Whole map" no country or region name is under the log.
    await expect.poll(async () => Math.round((await box(drawer)).right)).toBe(size.width);
    const pinned = await box(drawer);
    expect(pinned.width).toBeLessThanOrEqual(size.width * 0.27);
    expect(pinned.left).toBeGreaterThan(size.width / 2);
    await map.getByRole("button", { name: "Whole map" }).click();
    expect((await box(map.locator(".dm-view"))).right).toBeLessThanOrEqual(pinned.left + 0.5);
    await expect.poll(() => coveredOnMap(page)).toEqual([]);
    expect(await middleOfMapShown(page)).toBe(true);
    await expectNoPageScroll(page);
    await expectTapTargets(page);
    await shoot(page, testInfo, "l10", "log-pinned");

    // It stays: a tap elsewhere, Escape and a new decision leave it open.
    await page.getByTestId("status-bar").click();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeVisible();
    await playFromStrip(page);
    await expect(page.getByTestId("decision")).toBeVisible();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("log").locator("li")).not.toHaveCount(0);

    // Details opens over it and closes again; the pinned log is still there.
    await page.locator(".game-top").getByRole("button", { name: "Details" }).click();
    await expect(page.getByTestId("contingency")).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("contingency")).toBeHidden();
    await expect(drawer).toBeVisible();

    // Unpinned, it is the ordinary drawer again, about half the width, which a tap outside closes.
    await pinOf(page).click();
    await expect(pinOf(page)).toHaveText("Pin");
    await expect(drawer).toBeVisible();
    await expect.poll(async () => (await box(drawer)).width).toBeGreaterThan(size.width * 0.4);
    await page.getByTestId("status-bar").click();
    await expect(drawer).toBeHidden();

    // Pinned again, Close unpins and closes it, and the map has the whole width back.
    await page.getByTestId("ticker").click();
    await pinOf(page).click();
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();
    await expect.poll(async () => Math.round((await box(map.locator(".dm-view"))).right)).toBe(size.width);
  }
});

test("on a large screen the strip shows bigger cards with their full names, and the text is larger", async ({
  page,
}, testInfo) => {
  for (const size of sizesFor(page)) {
    await page.setViewportSize(size);
    await startSixRegionGame(page);
    const font = await page.locator(".game").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    const strip = await box(page.getByTestId("hand"));
    const chips = stripChips(page);
    // How many chips show whole without scrolling the strip, for the record (the strip scrolls sideways for more).
    const whole = await page.getByTestId("hand").evaluate((hand) => {
      const cards = hand.querySelector(".strip-cards")!.getBoundingClientRect();
      return [...hand.querySelectorAll(".strip-chip")].filter((chip) => {
        const r = chip.getBoundingClientRect();
        return r.left >= cards.left - 0.5 && r.right <= cards.right + 0.5;
      }).length;
    });
    testInfo.annotations.push({ type: "chips shown whole", description: `${size.width}x${size.height}: ${whole}` });
    if (!isLarge(size)) {
      // A phone held sideways keeps its slim strip and small text.
      expect(font).toBe(13);
      expect(strip.height).toBeLessThanOrEqual(56);
      continue;
    }
    // Larger text, growing with the screen: at least 16 px at 1280 wide, 20 px at 1920.
    expect(font).toBeGreaterThanOrEqual(size.width >= 1920 ? 20 : 16);
    // The strip stays slim; each chip is bigger, and shows its card's whole name, cut short nowhere.
    expect(strip.height).toBeLessThanOrEqual(72);
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      await chip.scrollIntoViewIfNeeded();
      const c = await box(chip);
      expect(c.height).toBeGreaterThanOrEqual(56);
      const name = chip.locator(".strip-chip-name");
      const n = await box(name);
      // Cut short: its text runs past its own box (a pixel is left for rounding a line's height).
      const cut = await name.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      );
      expect(cut, `${size.width}: ${await name.innerText()}`).toBe(false);
      expect(n.top).toBeGreaterThanOrEqual(c.top);
      expect(n.bottom).toBeLessThanOrEqual(c.bottom);
      expect(n.right).toBeLessThanOrEqual(c.right);
    }
    // Not only this hand's: every card name in the game fits whole on a chip, written in turn on the first chip.
    expect(CARD_NAMES.length).toBeGreaterThan(40);
    for (const name of CARD_NAMES) expect(name).toMatch(/\S/);
    expect(await namesThatDoNotFit(page, CARD_NAMES), `${size.width}`).toEqual([]);
  }
});

/** Every card's name in the game's content (packages/content/cards: each card's `text.name`). */
const CARD_NAMES: string[] = readdirSync(CARDS, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".json"))
  .map((file) => (JSON.parse(readFileSync(path.join(CARDS, file), "utf8")) as { text?: { name?: string } }).text?.name)
  .map((name) => name ?? "");

/** The names that, written on the strip's first chip, would run past it or be cut short. */
const namesThatDoNotFit = (page: Page, names: string[]): Promise<string[]> =>
  stripChips(page)
    .first()
    .evaluate((chip, all) => {
      const name = chip.querySelector<HTMLElement>(".strip-chip-name")!;
      const was = name.textContent;
      const bad = all.filter((text) => {
        name.textContent = text;
        const c = chip.getBoundingClientRect();
        const n = name.getBoundingClientRect();
        const cut = name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1;
        return cut || n.top < c.top || n.bottom > c.bottom || n.right > c.right;
      });
      name.textContent = was;
      return bad;
    }, names);
