// The top bar, with the ticker at its right end, and the log drawer the ticker opens (L5, #485; L9, #489;
// docs/design/screen-layout.md). The ticker shows the newest log line exactly as the log has it, so it can never
// show more than the log. It sits in the top bar, a tap target tall, rather than in a row of its own under it, so
// the map keeps every pixel (Decision (architect) on #489). Tapping it opens the full log, newest first, in a drawer
// from the right, which closes again on a tap outside it, on Escape, on Close, and when a new decision waits for
// the player (drawerControl.ts). The drawer is a grid item of the game (logDrawer.css), so L10 (#490) can pin it
// open on a large screen by changing only when it shows. Whether it is open is local UI state, so GameScreen stays
// hook-free: the hooks live here.
import type { Decision } from "@terminal-dusk/engine";
import { memo, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dismissDrawer, drawerShown } from "./drawerControl.ts";
import type { Opened } from "./drawerControl.ts";
import { Log } from "./regions.tsx";
import "./logDrawer.css";

type TopBarProps = {
  /** Log lines, oldest first. */
  log: readonly string[];
  /** The decision waiting for the player now, or null. */
  waitingId: Decision["id"] | null;
  /** The top bar's other items, before the ticker: the Menu, the page's own items, the status and the tracks. */
  children: ReactNode;
};

function TopBarInner({ log, waitingId, children }: Readonly<TopBarProps>) {
  const [opened, setOpened] = useState<Opened>(null);
  const shown = drawerShown(opened, waitingId);
  // A drawer a new decision has closed is forgotten, so it does not open again once that decision is answered.
  if (opened !== null && !shown) setOpened(null);
  const id = useId();
  const ticker = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // While it shows: the keyboard's place moves into it, and Escape or a tap outside closes it. The focus does not
  // scroll: the drawer starts its slide off to the right, and scrolling it into view would shift the whole game.
  useEffect(() => {
    if (!shown || drawer.current === null || ticker.current === null) return;
    drawer.current.focus({ preventScroll: true });
    return dismissDrawer(document, { drawer: drawer.current, ticker: ticker.current }, () => setOpened(null));
  }, [shown]);

  const newest = log.at(-1);
  return (
    <>
      <div className="game-top">
        {children}
        <button
          ref={ticker}
          type="button"
          className="game-ticker"
          data-testid="ticker"
          aria-expanded={shown}
          aria-controls={id}
          onClick={() => setOpened(shown ? null : { forId: waitingId })}
        >
          <span className="game-ticker-mark" aria-hidden="true">
            {"›"}
          </span>
          <span className="game-ticker-line">{newest ?? "Nothing has happened yet"}</span>
        </button>
      </div>
      <div
        ref={drawer}
        id={id}
        role="dialog"
        aria-label="Game log"
        className="game-drawer"
        tabIndex={-1}
        hidden={!shown}
      >
        <div className="game-drawer-head">
          <span className="game-drawer-title">Log</span>
          <button
            type="button"
            onClick={() => {
              setOpened(null);
              ticker.current?.focus();
            }}
          >
            Close
          </button>
        </div>
        <Log log={log} />
      </div>
    </>
  );
}

/**
 * Wrapped in `memo`, like SideTabs and ZoomableMap: a memo element is not a plain function, so the test walkers
 * that call function components directly (testMode/promptTree.ts, online/test/screenTree.ts) step over its hooks
 * and walk on into its children, reaching the page's own buttons in the top bar (such as Back).
 */
export const TopBar = memo(TopBarInner);
