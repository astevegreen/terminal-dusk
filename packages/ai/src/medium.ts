// The Medium tier (docs/architecture.md, Decision 8): Easy's scoring, plus the cards it has not seen and an
// evaluation of the board it would leave, in era-end region scoring terms, and of Escalation. Same inputs and output
// as easyAnswer; the tier is the weights. Sees only its own view and guesses the rest.
import { apply, legalAnswers, pendingFor, reconstruct } from "@terminal-dusk/engine";
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { namedCard } from "./easy.ts";
import { boardValue } from "./evaluate.ts";
import { guessHidden } from "./guess.ts";
import { safetyScore } from "./safety.ts";
import type { MediumWeights } from "./types.ts";

/** The state reconstruct() makes from a view (the name GameState stays with the engine and host, hard rule 2). */
type Guessed = ReturnType<typeof reconstruct>;

/** The value of winning or losing the game outright: past anything the board can be worth. */
const GAME_END = 1000;

/**
 * How good the state is for `side` after it gives `answer`. An answer that only chooses between ways of spending
 * points (place, realign) is worth the best next answer `depth` steps on.
 */
function afterValue(
  ruleset: Ruleset,
  state: Guessed,
  side: Side,
  answer: AnswerValue,
  weights: MediumWeights,
  depth: number,
): number {
  const pending = pendingFor(state, side);
  if (pending === null) return 0;
  const applied = apply(ruleset, state, { decisionId: pending.id, side, value: answer });
  if (!applied.ok) return -Infinity;
  const next = applied.value.state;
  const { status } = next.public;
  if (status.kind === "over") return status.winner === null ? 0 : status.winner === side ? GAME_END : -GAME_END;
  const following = pendingFor(next, side);
  if (depth > 0 && following !== null && (following.kind === "placeInfluence" || following.kind === "realign")) {
    const values = legalAnswers(ruleset, next, side).map((a) => afterValue(ruleset, next, side, a, weights, depth - 1));
    return Math.max(...values);
  }
  return boardValue(next.public, side, weights);
}

/**
 * The best-scoring legal answer for `side`, or null when nothing is pending for it. A score is Easy's
 * `ops * printed ops + rivalCard * (1 if the card is the rival's) + noise * random()`, plus for a card answer its
 * safety (safety.ts) and for any other answer the board it leaves (evaluate.ts). Ties go to the earlier answer.
 */
export function mediumAnswer(
  ruleset: Ruleset,
  view: PlayerView,
  side: Side,
  weights: MediumWeights,
  random: () => number,
): AnswerValue | null {
  if (!view.public.pending.some((decision) => decision.side === side)) return null;
  const state = reconstruct(view, guessHidden(ruleset, view, side, random));
  let best: AnswerValue | null = null;
  let bestScore = -Infinity;
  for (const answer of legalAnswers(ruleset, state, side)) {
    const card = namedCard(ruleset, answer);
    const ops = card?.ops ?? 0;
    const rival = card !== null && card.affiliation !== "neutral" && card.affiliation !== side ? 1 : 0;
    let score = weights.ops * ops + weights.rivalCard * rival + weights.noise * random();
    if (card !== null) score += safetyScore(ruleset, view, side, card, answer, weights);
    else score += afterValue(ruleset, state, side, answer, weights, answer.kind === "chooseAction" ? 1 : 0);
    if (score > bestScore) {
      best = answer;
      bestScore = score;
    }
  }
  return best;
}
