import { apply } from "./apply.ts";
import { createGame } from "./createGame.ts";
import type { Answer, GameEvent, GameState, Result, Ruleset, Seed, Setup } from "./types.ts";

/**
 * Checks a finished game from its revealed seed: the seed must match the setup's published fingerprint,
 * and every answer must apply in order. Returns the final state and every event, createGame's first. A
 * refused answer returns apply's code with its place in the log; a log that ends with the game still
 * active is `unfinishedLog`, never a verified game. Error messages never hold the seed.
 */
export function verifyGame(
  ruleset: Ruleset,
  setup: Setup,
  seed: Seed,
  answers: readonly Answer[],
): Result<{ state: GameState; events: GameEvent[] }> {
  const start = createGame(ruleset, setup, seed);
  if (!start.ok) return start;
  let { state } = start.value;
  const events = [...start.value.events];
  for (const [i, answer] of answers.entries()) {
    const step = apply(ruleset, state, answer);
    if (!step.ok) {
      const why = step.error.message === undefined ? "" : `: ${step.error.message}`;
      return {
        ok: false,
        error: { code: step.error.code, message: `Answer ${i + 1} of ${answers.length} was refused${why}` },
      };
    }
    state = step.value.state;
    events.push(...step.value.events);
  }
  if (state.public.status.kind === "active") {
    return {
      ok: false,
      error: { code: "unfinishedLog", message: "The answer log ends before the game does." },
    };
  }
  return { ok: true, value: { state, events } };
}
