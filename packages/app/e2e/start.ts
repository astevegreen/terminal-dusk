// Shared starts for the Playwright smoke tests (not a test file: only *.e2e.ts files are tests).
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Makes the page's random numbers a fixed sequence from `seed`, before the app loads. The app takes its game seed
 * and the AI's seed only from crypto.getRandomValues (appRoot.tsx), and the Easy AI is deterministic from its seed, so
 * the same seed plays the same game every run: a test that needs a decision the game reaches only sometimes is seeded
 * to reach it (#505).
 */
export async function fixRandom(page: Page, seed: number): Promise<void> {
  await page.addInitScript((start: number) => {
    let s = start >>> 0 || 1;
    // xorshift32: a small fixed sequence, only for the test's page.
    const next = (): number => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s;
    };
    const fill = <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) for (let i = 0; i < array.length; i++) array[i] = next();
      else if (array !== null) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < bytes.length; i++) bytes[i] = next() & 0xff;
      }
      return array;
    };
    crypto.getRandomValues = fill as typeof crypto.getRandomValues;
  }, seed);
}

/**
 * The app as a signed-in owner of the Full Game sees it (e2e/owner/): a free player's games against the AI stop after
 * Era 1 (#686), so a test of a full game opens this page.
 */
export const OWNER_PAGE = "/e2e/owner/index.html";

/** Each full game's home button, and how its side picker's note starts. */
const OWNER_NOTES = {
  "Play against the AI": /^First deck, the base game: 10 turns/,
  "Play the six-region map": /^First deck on the six-region map/,
  "Play the 2025-2027 game": /^The 2025-2027 game: 11 turns/,
} as const;

/**
 * Opens an owner's side picker for the game behind `button`, and waits until it shows the full game: until the app
 * has read what the player owns, the same button leads to the free game.
 */
export async function openOwnerGame(page: Page, button: keyof typeof OWNER_NOTES): Promise<void> {
  await page.goto(OWNER_PAGE);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByText(OWNER_NOTES[button])).toBeVisible();
}

/**
 * Opens the full six-region map game against the AI as LIO, as an owner, and waits for the first decision; returns
 * the map area. With a `seed`, the game is the same every run (fixRandom).
 */
export async function startSixRegionGame(page: Page, seed?: number): Promise<Locator> {
  if (seed !== undefined) await fixRandom(page, seed);
  await openOwnerGame(page, "Play the six-region map");
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  return page.getByTestId("map-area");
}

/** The page's whole size, so a test can check it is no taller or wider than the screen. */
export async function pageSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
}
