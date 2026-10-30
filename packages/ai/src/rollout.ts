// One rollout of the Hard tier (docs/architecture.md, Decision 8): from a guessed full state, play a candidate answer,
// then both sides on as noise-free Medium players for a few card plays each, and value where it ends. Each side
// answers from its own view of the guessed state, so the simulated rival guesses too and nobody sees more than a
// player would.
import { apply, pendingFor, reconstruct, viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, Ruleset, Side } from "@terminal-dusk/engine";
import { boardValue } from "./evaluate.ts";
import { GAME_END, mediumAnswer } from "./medium.ts";
import type { MediumWeights } from "./types.ts";

/** The state reconstruct() makes from a view (the name GameState stays with the engine and host, hard rule 2). */
type Guessed = ReturnType<typeof reconstruct>;

/** A rollout still going after this many answers stops and is valued where it is. */
export const STEP_CAP = 60;

/** Answers that play a card: what a rollout's rounds count. */
const playsCard = (answer: AnswerValue): boolean => answer.kind === "chooseCard" || answer.kind === "playCardAs";

/** How far the score track leans towards `side` (it runs from LIO's end, negative, to SAE's, positive). */
const scoreLean = (state: Guessed, side: Side): number => {
  const score = state.public.score ?? 0;
  return side === "lio" ? -score : score;
};

/** What a rollout reports: its value for the side, and how many answers it took after the candidate. */
export type RolloutResult = { value: number; steps: number };

/**
 * Plays `candidate` for `side` on `state`, then the game on with `mediumAnswer` (noise 0) on both sides until each
 * side has played `rounds` more cards, the game ends, or STEP_CAP answers have been given. The value is GAME_END
 * (or minus it) for a win (or loss), 0 for a draw, and otherwise the board left (boardValue) plus what the score
 * track moved towards `side` since the start, in region points. `random` drives the simulated players' guesses.
 */
export function rollout(
  ruleset: Ruleset,
  state: Guessed,
  side: Side,
  candidate: AnswerValue,
  weights: MediumWeights,
  rounds: number,
  random: () => number,
): RolloutResult {
  const quiet: MediumWeights = { ...weights, noise: 0 };
  const startLean = scoreLean(state, side);
  const first = pendingFor(state, side);
  if (first === null) return { value: -Infinity, steps: 0 };
  const applied = apply(ruleset, state, { decisionId: first.id, side, value: candidate });
  if (!applied.ok) return { value: -Infinity, steps: 0 };
  let current = applied.value.state;
  const plays = { lio: 0, sae: 0 };
  let steps = 0;
  while (current.public.status.kind === "active" && steps < STEP_CAP && Math.min(plays.lio, plays.sae) < rounds) {
    const decision = current.public.pending[0];
    if (decision === undefined) break;
    const answer = mediumAnswer(ruleset, viewFor(current, decision.side), decision.side, quiet, random);
    if (answer === null) break;
    const next = apply(ruleset, current, { decisionId: decision.id, side: decision.side, value: answer });
    if (!next.ok) break;
    if (playsCard(answer)) plays[decision.side]++;
    current = next.value.state;
    steps++;
  }
  const { status } = current.public;
  if (status.kind === "over") {
    return { value: status.winner === null ? 0 : status.winner === side ? GAME_END : -GAME_END, steps };
  }
  const moved = scoreLean(current, side) - startLean;
  return { value: boardValue(current.public, side, weights) + weights.region * moved, steps };
}
