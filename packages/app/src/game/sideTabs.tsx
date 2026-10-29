// The sheet's tab (L1, issue #464; L5, #485; docs/architecture.md, Decision 6): Details (the opponent, the table and
// the Contingency decks), with Hide beside it, which folds the sheet down to its tab row. The log left the sheet for
// its own drawer, opened from the ticker (L9, #489), and the decision is a banner above the hand strip, not a Play
// tab (L7, #487), so the sheet starts folded and a new decision folds it again, leaving the map clear to pick a
// country on. The tab picked is local UI state. GameScreen stays hook-free: the hook lives here.
import type { Decision } from "@terminal-dusk/engine";
import { Children, memo, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export type TabId = "details";
/** What the player last picked: a tab, or "hide" to fold the sheet. */
export type SheetPick = TabId | "hide";
type DecisionId = Decision["id"];

export const TABS: readonly { id: TabId; title: string }[] = [{ id: "details", title: "Details" }];

/**
 * The tab to show, or null for a folded sheet. `picked` is what the player last picked (null: nothing yet),
 * `pickedForDecisionId` the decision waiting when they picked it, and `waitingId` the decision waiting now (null:
 * none). A pick holds only while the same decision waits (a refusal or a re-render keeps the id), so a new
 * decision folds the sheet.
 */
export function shownTab(
  picked: SheetPick | null,
  pickedForDecisionId: DecisionId | null,
  waitingId: DecisionId | null,
): TabId | null {
  if (picked === null || pickedForDecisionId !== waitingId) return null;
  return picked === "hide" ? null : picked;
}

type Pick = { tab: SheetPick; forId: DecisionId | null } | null;

function SideTabsInner({ waitingId, children }: Readonly<{ waitingId: DecisionId | null; children: ReactNode }>) {
  const panels = Children.toArray(children);
  const [pick, setPick] = useState<Pick>(null);
  const shown = shownTab(pick?.tab ?? null, pick?.forId ?? null, waitingId);
  // A pick a new decision has overridden is forgotten, so it does not come back once that decision is answered.
  if (pick !== null && pick.forId !== waitingId) setPick(null);
  const base = useId();
  const tablist = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="game-sheet-bar">
        <div ref={tablist} role="tablist" aria-label="Side panel" className="game-tabs">
          {TABS.map(({ id, title }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${base}-${id}-tab`}
              aria-selected={id === shown}
              aria-controls={`${base}-${id}`}
              onClick={() => setPick({ tab: id, forId: waitingId })}
            >
              {title}
            </button>
          ))}
        </div>
        {/* Outside the tablist, as it is not a tab; gone while the sheet is folded, so the keyboard's place moves to
            the tab that was open, which opens it again. */}
        <button
          type="button"
          className="game-sheet-hide"
          hidden={shown === null}
          onClick={() => {
            tablist.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
            setPick({ tab: "hide", forId: waitingId });
          }}
        >
          Hide
        </button>
      </div>
      {/* Each panel is the scrolling element, so the keyboard can reach it; an inactive one is hidden. */}
      {TABS.map(({ id }, i) => (
        <div
          role="tabpanel"
          key={id}
          id={`${base}-${id}`}
          aria-labelledby={`${base}-${id}-tab`}
          className="game-tab-panel"
          tabIndex={0}
          hidden={id !== shown}
        >
          {panels[i]}
        </div>
      ))}
    </>
  );
}

/**
 * Takes its panels as children, in TABS order. Wrapped in `memo`, like ZoomableMap: a memo element is not
 * a plain function, so the test walkers that call function components directly (testMode/promptTree.ts,
 * online/test/screenTree.ts) step over its hook and walk on into the panels, reaching the prompts and the hand.
 */
export const SideTabs = memo(SideTabsInner);
