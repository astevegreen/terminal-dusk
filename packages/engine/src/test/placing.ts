// Test helper: finishing the placings a play for points asks for in a game with a map (R16a, placing.ts).
import { legalAnswers } from "../decisions.ts";
import type { GameEvent, GameState, Ruleset } from "../types.ts";
import { applied, ruleset } from "./game.ts";

type Played = { state: GameState; events: GameEvent[] };

/**
 * Answers every open placeInfluence decision with its first legal answer until none is open, and returns the
 * state then with `played`'s events followed by every event the placings caused.
 */
export function placeAll(played: Played, rs: Ruleset = ruleset): Played {
  let { state } = played;
  const events = [...played.events];
  for (let d = state.public.pending[0]; d?.kind === "placeInfluence"; d = state.public.pending[0]) {
    const next = applied(state, { decisionId: d.id, side: d.side, value: legalAnswers(rs, state, d.side)[0]! }, rs);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
}
