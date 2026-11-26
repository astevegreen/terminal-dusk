// Shared by the Resilient institutions redraw tests (resilientRedrawCallers.test.ts, resilientCardDraws.test.ts).
import type { DeckId, GameEvent, GameState, Ruleset, Setup } from "../index.ts";
import { playAnswers, ruleset, startGame } from "./game.ts";
import { mapSetup } from "./map.ts";

export const ABILITIES: NonNullable<Setup["abilities"]> = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "unifiedCommand", bonus: 1 },
};

/** `state` with `deck`'s next draws being `values`, in that order (the deck keeps the same cards). */
export function drawsNext(state: GameState, deck: DeckId, values: number[]): GameState {
  const rest = [...state.secret.contingency[deck]];
  for (const v of values) {
    const at = rest.indexOf(v);
    if (at < 0) throw new Error(`${deck}'s deck has no ${v} left`);
    rest.splice(at, 1);
  }
  const contingency = { ...state.secret.contingency, [deck]: [...values, ...rest] };
  return { ...state, secret: { ...state.secret, contingency } };
}

/** A game with `abilities` (both sides' by default) at LIO's first play, LIO's next draws being 1 then 4. */
export function game(setup: Setup = mapSetup(), rs: Ruleset = ruleset, abilities = ABILITIES): GameState {
  const start = playAnswers(startGame(2, 1, rs, { ...setup, abilities }), 2, rs);
  return drawsNext(start, "lio", [1, 4]);
}

export const drawn = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [`${e.deck}:${e.value}`] : []));
export const redraws = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "abilityRedraw");
