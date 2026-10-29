// The top bar, with the Details button and the ticker at its right end, and the two panels they open (L5, #485; L9,
// #489; L10, #490; docs/design/screen-layout.md). The ticker shows the newest log line exactly as the log has it, so
// it can never show more than the log. It sits in the top bar, a tap target tall, rather than in a row of its own
// under it, so the map keeps every pixel (Decision (architect) on #489). Tapping it opens the full log, newest
// first, in a drawer from the right; the Details button opens the Details panel (the rival's hand size, the cards in
// play, the discard pile and the Contingency decks) in the same place. One shows at a time, and the open one closes
// on a tap outside it, on Escape, on Close, and when a new decision waits for the player (drawerControl.ts). On a
// large screen the log can be pinned open at the side instead: it then stays, and the map fits itself beside it
// (logDrawer.css). What is open or pinned is local UI state, so GameScreen stays hook-free: the hooks live here.
import type { Decision } from "@terminal-dusk/engine";
import { memo, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { dismissable, dismissPanel, logShown, shownPanel } from "./drawerControl.ts";
import type { Opened, PanelId } from "./drawerControl.ts";
import { useLargeScreen } from "./largeScreen.ts";
import { Log } from "./regions.tsx";
import "./logDrawer.css";

type TopBarProps = {
  /** Log lines, oldest first. */
  log: readonly string[];
  /** The decision waiting for the player now, or null. */
  waitingId: Decision["id"] | null;
  /** What the Details panel holds; left out, the bar has no Details button and no panel. */
  details?: ReactNode;
  /** The top bar's other items, before the Details button and the ticker: the Menu, the page's own items, the
   *  status and the tracks. */
  children: ReactNode;
};

/** A panel's head: its title, Close, and anything after Close (the log's Pin). */
function PanelHead({
  title,
  onClose,
  children,
}: Readonly<{ title: string; onClose: () => void; children?: ReactNode }>) {
  return (
    <div className="game-drawer-head">
      <span className="game-drawer-title">{title}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  );
}

/** While `active` panel shows: the keyboard's place moves into it, and Escape or a tap outside closes it. */
function useDismiss(
  active: PanelId | null,
  refs: Record<PanelId, { panel: RefObject<HTMLDivElement | null>; opener: RefObject<HTMLButtonElement | null> }>,
  close: () => void,
): void {
  useEffect(() => {
    if (active === null) return;
    const { panel, opener } = refs[active];
    if (panel.current === null || opener.current === null) return;
    // The focus does not scroll: the panel starts its slide off to the right, and scrolling it into view would shift
    // the whole game.
    panel.current.focus({ preventScroll: true });
    return dismissPanel(document, { panel: panel.current, opener: opener.current }, close);
    // The refs and `close` do the same for the bar's whole life; only a change of panel restarts the wiring.
  }, [active]);
}

function TopBarInner({ log, waitingId, details, children }: Readonly<TopBarProps>) {
  const [opened, setOpened] = useState<Opened>(null);
  const [pinned, setPinned] = useState(false);
  const large = useLargeScreen();
  const shown = shownPanel(opened, waitingId);
  // A panel a new decision has closed is forgotten, so it does not open again once that decision is answered.
  if (opened !== null && shown === null) setOpened(null);
  const pinnedLog = pinned && large;
  const logOpen = logShown(shown, pinned, large);
  const id = useId();
  const refs = {
    log: { panel: useRef<HTMLDivElement>(null), opener: useRef<HTMLButtonElement>(null) },
    details: { panel: useRef<HTMLDivElement>(null), opener: useRef<HTMLButtonElement>(null) },
  };
  useDismiss(dismissable(shown, pinnedLog), refs, () => setOpened(null));

  const open = (panel: PanelId): void => setOpened({ panel, forId: waitingId });
  const closeLog = (): void => {
    setPinned(false);
    if (shown === "log") setOpened(null);
  };
  const newest = log.at(-1);
  return (
    <>
      <div className="game-top">
        {children}
        {details !== undefined && (
          <button
            ref={refs.details.opener}
            type="button"
            className="game-details-button"
            aria-expanded={shown === "details"}
            aria-controls={`${id}-details`}
            onClick={() => (shown === "details" ? setOpened(null) : open("details"))}
          >
            Details
          </button>
        )}
        <button
          ref={refs.log.opener}
          type="button"
          className="game-ticker"
          data-testid="ticker"
          aria-expanded={logOpen}
          aria-controls={`${id}-log`}
          onClick={() => (logOpen ? closeLog() : open("log"))}
        >
          <span className="game-ticker-mark" aria-hidden="true">
            {"›"}
          </span>
          <span className="game-ticker-line">{newest ?? "Nothing has happened yet"}</span>
        </button>
      </div>
      <div
        ref={refs.log.panel}
        id={`${id}-log`}
        role="dialog"
        aria-label="Game log"
        className="game-drawer"
        data-pinned={pinnedLog}
        tabIndex={-1}
        hidden={!logOpen}
      >
        <PanelHead
          title="Log"
          onClose={() => {
            closeLog();
            refs.log.opener.current?.focus();
          }}
        >
          {/* After Close, so the keyboard meets Close first; only a large screen has the room to pin it. Unpinned,
              it stays open as an ordinary drawer until it is closed. */}
          <button
            type="button"
            className="game-drawer-pin"
            aria-pressed={pinnedLog}
            hidden={!large}
            onClick={() => {
              if (pinnedLog) open("log");
              setPinned(!pinnedLog);
            }}
          >
            {pinnedLog ? "Unpin" : "Pin"}
          </button>
        </PanelHead>
        <Log log={log} />
      </div>
      {details !== undefined && (
        <div
          ref={refs.details.panel}
          id={`${id}-details`}
          role="dialog"
          aria-label="Game details"
          className="game-drawer game-details"
          tabIndex={-1}
          hidden={shown !== "details"}
        >
          <PanelHead
            title="Details"
            onClose={() => {
              setOpened(null);
              refs.details.opener.current?.focus();
            }}
          />
          {/* The scrolling part, which the keyboard can reach, as the log's list can. */}
          <div className="game-details-body" role="group" aria-label="Details" tabIndex={0}>
            {details}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Wrapped in `memo`, like ZoomableMap and HandStrip: a memo element is not a plain function, so the test walkers
 * that call function components directly (testMode/promptTree.ts, online/test/screenTree.ts) step over its hooks
 * and walk on into its children, reaching the page's own buttons in the top bar (such as Back).
 */
export const TopBar = memo(TopBarInner);
