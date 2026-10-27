// Test helper: finishing the placings a play for points asks for in a game with a map (R16a, placing.ts), picking
// "place" on the action menu when it is offered, and "pass" when placing is not (R16c, actionMenu.ts).
import { legalAnswers } from "../decisions.ts";
import type { AnswerValue, Decision, GameEvent, GameState, Ruleset } from "../types.ts";
import { applied, ruleset } from "./game.ts";

type Played = { state: GameState; events: GameEvent[] };

/** The menu answer that never realigns: "place" when the menu offers it, otherwise "pass". */
const notRealigning = (d: Decision): AnswerValue => ({
  kind: "chooseAction",
  action: "actions" in d.options && d.options.actions.includes("place") ? "place" : "pass",
});

/**
 * Answers an open action menu with "place" (or "pass" without it), and every open placeInfluence decision with
 * its first legal answer, until neither is open, and returns the state then with `played`'s events followed by
 * every event they caused.
 */
export function placeAll(played: Played, rs: Ruleset = ruleset): Played {
  let { state } = played;
  const events = [...played.events];
  for (
    let d = state.public.pending[0];
    d?.kind === "placeInfluence" || d?.kind === "chooseAction";
    d = state.public.pending[0]
  ) {
    const value = d.kind === "chooseAction" ? notRealigning(d) : legalAnswers(rs, state, d.side)[0]!;
    const next = applied(state, { decisionId: d.id, side: d.side, value }, rs);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
}
