// The rules of the two panels the top bar opens (L9, #489; L10, #490; docs/design/screen-layout.md), kept apart from
// React so they are tested without a browser: the log drawer the ticker opens and the Details panel the Details
// button opens. One shows at a time (principle 5: one thing open at a time). Neither stays over the map: Escape
// closes the open one and puts the keyboard back on its opener, a tap anywhere outside it and its opener closes it,
// and a new decision for the player closes it, so the decision is never under it. The one exception is the log
// pinned open at the side of a large screen (L10), which stays until the player unpins or closes it.
import type { Decision } from "@terminal-dusk/engine";

type DecisionId = Decision["id"];

/** The panels the top bar opens. */
export type PanelId = "log" | "details";

/** The player opened `panel` while `forId` waited (null: no decision waited), or null: none is open. */
export type Opened = { panel: PanelId; forId: DecisionId | null } | null;

/** The panel that shows, with `waitingId` the decision waiting now (null: none), or null for none. */
export function shownPanel(opened: Opened, waitingId: DecisionId | null): PanelId | null {
  return opened !== null && opened.forId === waitingId ? opened.panel : null;
}

/**
 * Whether the log shows: opened and still showing, or pinned. A pinned log shows only on a large screen
 * (`large`), so a window made narrow again gets back the map it covered.
 */
export function logShown(shown: PanelId | null, pinned: boolean, large: boolean): boolean {
  return shown === "log" || (pinned && large);
}

/**
 * The panel that closes on Escape or on a tap outside it, or null: the one shown, unless that is the log and the
 * log is pinned, which stays.
 */
export function dismissable(shown: PanelId | null, pinnedLog: boolean): PanelId | null {
  return shown === "log" && pinnedLog ? null : shown;
}

/** What the wiring needs of a part of the page: whether a tapped thing is inside it. */
export type PanelPart = { contains: (node: Node | null) => boolean };
export type PanelParts = { panel: PanelPart; opener: PanelPart & { focus: () => void } };

/**
 * While a panel is open: listens on `doc` for Escape and for a tap outside both the panel and its opener, and calls
 * `close`. A tap on the opener is left to the opener, which closes the panel itself. Returns the function that stops
 * it.
 */
export function dismissPanel(doc: EventTarget, parts: PanelParts, close: () => void): () => void {
  const onKey = (event: Event): void => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    close();
    parts.opener.focus();
  };
  const onPointer = (event: Event): void => {
    const target = event.target as Node | null;
    if (parts.panel.contains(target) || parts.opener.contains(target)) return;
    close();
  };
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("pointerdown", onPointer);
  return () => {
    doc.removeEventListener("keydown", onKey);
    doc.removeEventListener("pointerdown", onPointer);
  };
}
