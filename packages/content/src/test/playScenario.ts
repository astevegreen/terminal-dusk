// Test helper: plays a real scenario to its end with the first legal answer every time, started as
// packages/host/src/firstDeck.ts starts a game (empty hands, Era 1's cards in the draw pile), optionally on a map
// from another scenario as sixRegionMapConfig does. It records the turns on which the eras scored, so a test can
// check the scenario's era ends from what the engine did, not from the file.
import { apply, createGame, legalAnswers, seedHash } from "@terminal-dusk/engine";
import type { Setup } from "@terminal-dusk/engine";
import type { Scenario } from "../../schema/scenario.ts";
import { ERA_1_CARDS } from "../era1.ts";
import { FIRST_DECK_RULESET } from "../firstDeckRules.ts";
import { scenarioSetup } from "../scenario.ts";

/** More answers than any real game needs; past it the game is taken not to end. */
const MOST_ANSWERS = 5000;

/**
 * Plays `scenario` from `seed` to its end, on `map` when given (the scenario's own map otherwise). Returns the turns
 * its regions scored on, the turn each era entered on, and its last state.
 */
export function playScenario(scenario: Scenario, seed: string, map?: Setup["map"]) {
  const setup: Setup = {
    seedHash: seedHash(seed),
    hands: { lio: [], sae: [] },
    deck: ERA_1_CARDS.map((c) => c.id),
    ...scenarioSetup(scenario),
    ...(map === undefined ? {} : { map }),
  };
  const made = createGame(FIRST_DECK_RULESET, setup, seed);
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  let state = made.value.state;
  const scored = new Set<number>();
  const eraTurns: Record<string, number> = {};
  for (let answers = 0; state.public.status.kind === "active"; answers++) {
    if (answers === MOST_ANSWERS) throw new Error(`the ${scenario.id} game did not end`);
    const decision = state.public.pending[0]!;
    const value = legalAnswers(FIRST_DECK_RULESET, state, decision.side)[0]!;
    const ending = state.public.turn;
    const applied = apply(FIRST_DECK_RULESET, state, { decisionId: decision.id, side: decision.side, value });
    if (!applied.ok) throw new Error(`apply refused: ${applied.error.code}`);
    state = applied.value.state;
    for (const event of applied.value.events) {
      // Regions score at the end of the turn that was in play when the answer came in.
      if (event.kind === "regionScored") scored.add(ending);
      // An era starts as its turn begins, so the turn has moved on by the time the answer that ended the last returns.
      if (event.kind === "eraStarted") eraTurns[event.era] = Math.max(ending, state.public.turn);
    }
  }
  return { scoredTurns: [...scored].sort((a, b) => a - b), eraTurns, last: state };
}
