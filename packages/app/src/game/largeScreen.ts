// Whether the screen is large: 1200 px wide and up (L10, #490; docs/design/screen-layout.md). A large screen gets the
// same layout with more room: bigger cards in the hand strip, larger text (both pure CSS, at the same width), and
// the log drawer can be pinned open at the side. Pinning is behaviour, so the top bar asks this hook. It is a
// browser width, the same on every device, so it is no Platform difference (Decision 7).
import { useSyncExternalStore } from "react";

/** The media query for a large screen. The stylesheets' large-screen rules use the same width. */
export const LARGE_SCREEN = "(min-width: 1200px)";

type MediaSource = { matchMedia?: (query: string) => MediaQueryList };

/** Whether `source` (the window) matches the query now; false where it cannot tell, as on a server render. */
export function matchesLarge(source: MediaSource | undefined): boolean {
  return source?.matchMedia?.(LARGE_SCREEN).matches ?? false;
}

/** Calls `onChange` whenever the screen crosses the large width; returns the function that stops it. */
export function watchLarge(source: MediaSource | undefined, onChange: () => void): () => void {
  const list = source?.matchMedia?.(LARGE_SCREEN);
  if (list === undefined) return () => undefined;
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

const browser = (): MediaSource | undefined => (typeof window === "undefined" ? undefined : window);

/** True on a large screen, kept up to date as the window is resized; false on a server render. */
export function useLargeScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => watchLarge(browser(), onChange),
    () => matchesLarge(browser()),
    () => false,
  );
}
