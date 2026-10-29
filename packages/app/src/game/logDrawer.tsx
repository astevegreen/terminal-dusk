// The ticker and the log drawer (L9, #489; docs/design/screen-layout.md). The ticker, a line under the top bar, shows
// the newest log line exactly as the log has it, so it can never show more than the log. Tapping it opens the full
// log, newest first, in a drawer from the right, which closes again on a tap outside it, on Escape, on Close, and
// when a new decision waits for the player (drawerControl.ts). Both are grid items of the game (logDrawer.css), so
// L10 (#490) can pin the drawer open on a large screen by changing only when it shows. The open drawer is local UI
// state, so GameScreen stays hook-free: the hooks live here.
import type { Decision } from "@terminal-dusk/engine";
import { memo, useEffect, useId, useRef, useState } from "react";
import { dismissDrawer, drawerShown } from "./drawerControl.ts";
import type { Opened } from "./drawerControl.ts";
import { Log } from "./regions.tsx";
import "./logDrawer.css";

type LogDrawerProps = {
  /** Log lines, oldest first. */
  log: readonly string[];
  /** The decision waiting for the player now, or null. */
  waitingId: Decision["id"] | null;
};

function LogDrawerInner({ log, waitingId }: Readonly<LogDrawerProps>) {
  const [opened, setOpened] = useState<Opened>(null);
  const shown = drawerShown(opened, waitingId);
  // A drawer a new decision has closed is forgotten, so it does not open again once that decision is answered.
  if (opened !== null && !shown) setOpened(null);
  const id = useId();
  const ticker = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // While it shows: the keyboard's place moves into it, and Escape or a tap outside closes it.
  useEffect(() => {
    if (!shown || drawer.current === null || ticker.current === null) return;
    drawer.current.focus();
    return dismissDrawer(document, { drawer: drawer.current, ticker: ticker.current }, () => setOpened(null));
  }, [shown]);

  const newest = log.at(-1);
  return (
    <>
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
 * that call function components directly (testMode/promptTree.ts, online/test/screenTree.ts) step over its hooks.
 */
export const LogDrawer = memo(LogDrawerInner);
