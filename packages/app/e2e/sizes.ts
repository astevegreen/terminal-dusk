// The screen sizes the L10 (#490) tests check (not a test file: only *.e2e.ts files are tests). Each project checks
// its own size, and the desktop project 1920x1080 too, so the third size of #490's acceptance is covered without a
// third project running every other test again, and without a test that skips itself.
import type { Page } from "@playwright/test";

export type Size = { width: number; height: number };

/** A large monitor: the largest size #490's acceptance names. */
export const LARGE_MONITOR: Size = { width: 1920, height: 1080 };

/** The project's own size, then 1920x1080 when the project is a desktop one. */
export function sizesFor(page: Page): Size[] {
  const own = page.viewportSize()!;
  return own.width >= 1000 ? [own, LARGE_MONITOR] : [own];
}

/** Whether a size is large (1200 px wide and up, src/game/largeScreen.ts). */
export const isLarge = (size: Size): boolean => size.width >= 1200;
