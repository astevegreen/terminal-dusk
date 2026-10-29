// The large-screen check (L10, #490): 1200 px wide and up, asked of a stand-in window, as drawerControl.test.ts uses
// a stand-in document.
import { describe, expect, it } from "vitest";
import { LARGE_SCREEN, matchesLarge, watchLarge } from "./largeScreen.ts";

/** A window whose screen is `width` px wide, and that can be resized. */
function fakeWindow(width: number) {
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  const state = { width };
  const list = {
    get matches() {
      return state.width >= 1200;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  return {
    matchMedia: (query: string) => {
      queries.push(query);
      return list as unknown as MediaQueryList;
    },
    resize(to: number) {
      state.width = to;
      for (const fn of listeners) fn();
    },
    listeners,
    queries,
  };
}

describe("the large screen", () => {
  it("starts at 1200 px wide, the width screen-layout.md names", () => {
    expect(LARGE_SCREEN).toBe("(min-width: 1200px)");
    const win = fakeWindow(1200);
    expect(matchesLarge(win)).toBe(true);
    expect(win.queries).toEqual([LARGE_SCREEN]);
  });
  it("is not a phone held sideways (844) nor just under the width (1199)", () => {
    expect(matchesLarge(fakeWindow(844))).toBe(false);
    expect(matchesLarge(fakeWindow(1199))).toBe(false);
  });
  it("is never large where nothing can tell, as on a server render", () => {
    expect(matchesLarge(undefined)).toBe(false);
    expect(matchesLarge({})).toBe(false);
  });
  it("tells its watcher when the window crosses the width, until the watch stops", () => {
    const win = fakeWindow(1280);
    let told = 0;
    const stop = watchLarge(win, () => void told++);
    win.resize(900);
    expect(told).toBe(1);
    expect(matchesLarge(win)).toBe(false);
    stop();
    expect(win.listeners.size).toBe(0);
    win.resize(1920);
    expect(told).toBe(1);
  });
  it("watches nothing where nothing can tell", () => {
    expect(() => watchLarge(undefined, () => undefined)()).not.toThrow();
  });
});
