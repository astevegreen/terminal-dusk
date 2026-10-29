// The log drawer's rules (L9, #489; docs/design/screen-layout.md), kept apart from React so they are tested without
// a browser: when the drawer shows, and how it closes. It never stays over the map: Escape closes it and puts the
// keyboard back on the ticker, and a tap anywhere outside the drawer and the ticker closes it. A new decision for
// the player closes it too, as a new decision opens the sheet's Play tab (sideTabs.tsx).
import type { Decision } from "@terminal-dusk/engine";

type DecisionId = Decision["id"];

/** The player opened the drawer while `forId` waited (null: no decision waited), or null: it is closed. */
export type Opened = { forId: DecisionId | null } | null;

/** Whether the drawer shows, with `waitingId` the decision waiting now (null: none). */
export function drawerShown(opened: Opened, waitingId: DecisionId | null): boolean {
  return opened !== null && opened.forId === waitingId;
}

/** What the wiring needs of a part of the page: whether a tapped thing is inside it. */
export type DrawerPart = { contains: (node: Node | null) => boolean };
export type DrawerParts = { drawer: DrawerPart; ticker: DrawerPart & { focus: () => void } };

/**
 * While the drawer is open: listens on `doc` for Escape and for a tap outside both parts, and calls `close`.
 * A tap on the ticker is left to the ticker, which closes the drawer itself. Returns the function that stops it.
 */
export function dismissDrawer(doc: EventTarget, parts: DrawerParts, close: () => void): () => void {
  const onKey = (event: Event): void => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    close();
    parts.ticker.focus();
  };
  const onPointer = (event: Event): void => {
    const target = event.target as Node | null;
    if (parts.drawer.contains(target) || parts.ticker.contains(target)) return;
    close();
  };
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("pointerdown", onPointer);
  return () => {
    doc.removeEventListener("keydown", onKey);
    doc.removeEventListener("pointerdown", onPointer);
  };
}
