// Keyboard play: when a new decision waits for the player, focus moves to its first choice button.
// GameScreen, DecisionRegion and the prompts stay hook-free (their tests call them as plain functions), so the
// hook lives in this wrapper. The rule and the effect are plain functions, tested without a DOM library.
import type { Decision } from "@terminal-dusk/engine";
import { useEffect, useRef } from "react";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";

type DecisionId = Decision["id"];

/**
 * Move focus or not. `previousId` is the decision id seen at the last check (null when the screen has just
 * mounted or no decision was waiting). Focus moves only to a waiting decision with a new id, and only when the
 * screen can answer it: a refusal or a re-render keeps the same id, and a read-only screen never moves focus.
 */
export function shouldFocusDecision(previousId: DecisionId | null, decision: Decision | null, canAnswer: boolean) {
  return canAnswer && decision !== null && decision.id !== previousId;
}

/** The little the effect needs from the page: a place to find the decision's first button in. */
export type FocusRoot = { querySelector: (selector: string) => { focus: () => void } | null };
export const FIRST_CHOICE = '[data-testid="decision"] button';

/**
 * The effect: applies the rule, focuses the first choice inside `root` when it says so, and returns the id to
 * remember for the next check.
 */
export function applyDecisionFocus(
  previousId: DecisionId | null,
  decision: Decision | null,
  canAnswer: boolean,
  root: FocusRoot | null,
): DecisionId | null {
  if (shouldFocusDecision(previousId, decision, canAnswer)) root?.querySelector(FIRST_CHOICE)?.focus();
  return decision?.id ?? null;
}

/** The game screen, plus moving focus to each new decision's first choice. A plain div, so no new look. */
export function FocusingGameScreen(props: Readonly<GameScreenProps>) {
  const root = useRef<HTMLDivElement>(null);
  const previousId = useRef<DecisionId | null>(null);
  const decision = props.frame.decision;
  const canAnswer = props.onAnswer !== undefined;
  useEffect(() => {
    previousId.current = applyDecisionFocus(previousId.current, decision, canAnswer, root.current);
  }, [decision, canAnswer]);
  return (
    <div ref={root}>
      <GameScreen {...props} />
    </div>
  );
}
