// Test helper: finishing the placings a play for points asks for in a game with a map (R16a, placing.ts), picking
// "place" on the action menu when it is offered (R16c, actionMenu.ts).
import { legalAnswers } from "../decisions.ts";
import type { AnswerValue, GameEvent, GameState, Ruleset } from "../types.ts";
import { applied, ruleset } from "./game.ts";

type Played = { state: GameState; events: GameEvent[] };

const PLACE: AnswerValue = { kind: "chooseAction", action: "place" };

/**
 * Answers an open action menu with "place", and every open placeInfluence decision with its first legal answer,
 * until neither is open, and returns the state then with `played`'s events followed by every event they caused.
 */
export function placeAll(played: Played, rs: Ruleset = ruleset): Played {
  let { state } = played;
  const events = [...played.events];
  for (
    let d = state.public.pending[0];
    d?.kind === "placeInfluence" || d?.kind === "chooseAction";
    d = state.public.pending[0]
  ) {
    const value = d.kind === "chooseAction" ? PLACE : legalAnswers(rs, state, d.side)[0]!;
    const next = applied(state, { decisionId: d.id, side: d.side, value }, rs);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
}
