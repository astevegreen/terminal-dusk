// The side panel's three tabs (L1, issue #464; docs/architecture.md, Decision 6): Play (the decision and the
// hand), Log, and Details (the opponent, the table and the Contingency decks). The tab picked is local UI state;
// the Play tab opens by itself whenever a new decision waits. GameScreen stays hook-free: the hook lives here.
import type { Decision } from "@terminal-dusk/engine";
import { memo, useId, useState } from "react";
import type { ReactNode } from "react";

export type TabId = "play" | "log" | "details";
type DecisionId = Decision["id"];

export const TABS: readonly { id: TabId; title: string }[] = [
  { id: "play", title: "Play" },
  { id: "log", title: "Log" },
  { id: "details", title: "Details" },
];

/**
 * The tab to show. `picked` is the tab the player last picked (null: none yet), `pickedForDecisionId` the
 * decision waiting when they picked it, and `waitingId` the decision waiting now (null: none). A pick holds only
 * while the same decision waits (a refusal or a re-render keeps the id), so a new decision opens Play.
 */
export function shownTab(
  picked: TabId | null,
  pickedForDecisionId: DecisionId | null,
  waitingId: DecisionId | null,
): TabId {
  return picked !== null && pickedForDecisionId === waitingId ? picked : "play";
}

type Pick = { tab: TabId; forId: DecisionId | null } | null;

function SideTabsInner({
  waitingId,
  children,
}: Readonly<{ waitingId: DecisionId | null; children: readonly ReactNode[] }>) {
  const [pick, setPick] = useState<Pick>(null);
  const shown = shownTab(pick?.tab ?? null, pick?.forId ?? null, waitingId);
  // A pick a new decision has overridden is forgotten, so it does not come back once that decision is answered.
  if (pick !== null && shown !== pick.tab) setPick(null);
  const base = useId();
  return (
    <>
      <div role="tablist" aria-label="Side panel" className="game-tabs">
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
          {children[i]}
        </div>
      ))}
    </>
  );
}

/**
 * Takes its three panels as children, in TABS order. Wrapped in `memo`, like ZoomableMap: a memo element is not
 * a plain function, so the test walkers that call function components directly (testMode/promptTree.ts,
 * online/test/screenTree.ts) step over its hook and walk on into the panels, reaching the prompts and the hand.
 */
export const SideTabs = memo(SideTabsInner);
