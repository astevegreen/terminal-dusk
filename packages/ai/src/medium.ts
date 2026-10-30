// The Medium tier (docs/architecture.md, Decision 8): Easy's scoring, plus the cards it has not seen and an
// evaluation of the board it would leave, in era-end region scoring terms, and of Escalation. Same inputs and output
// as easyAnswer; the tier is the weights. Sees only its own view and guesses the rest.
import { apply, legalAnswers, pendingFor, reconstruct } from "@terminal-dusk/engine";
import type { AnswerValue, HiddenPart, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { namedCard } from "./easy.ts";
import { boardValue } from "./evaluate.ts";
import { guessHidden } from "./guess.ts";
import { crisisCost, safetyScore } from "./safety.ts";
import { drawVariants } from "./techRace.ts";
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
  // An answer that makes Escalation reach 6 (an intervention in a battleground) is a crisis for the side that gave it.
  const crises = applied.value.events.filter((e) => e.kind === "escalationCrisis" && e.side === side).length;
  return boardValue(next.public, side, weights) - crises * weights.crisis * crisisCost(state.public, side);
}

const ATTEMPT: AnswerValue = { kind: "chooseAction", action: "techRace" };

/**
 * What a tech race attempt by `side` is worth: the board each number left in its own Contingency deck would leave
 * drawn first (techRace.ts), weighted by its share. So the odds are the public ones, the first-there +1 included,
 * and a crisis from entering Hypersonics counts by how likely it is.
 */
export function attemptValue(
  ruleset: Ruleset,
  view: PlayerView,
  hidden: HiddenPart,
  side: Side,
  weights: MediumWeights,
): number {
  return drawVariants(view, hidden, side).reduce(
    (sum, v) => sum + v.weight * afterValue(ruleset, reconstruct(view, v.hidden), side, ATTEMPT, weights, 0),
    0,
  );
}

/**
 * The best-scoring legal answer for `side`, or null when nothing is pending for it. A score is Easy's
 * `ops * printed ops + rivalCard * (1 if the card is the rival's) + noise * random()`, plus for a card answer its
 * safety (safety.ts), for a tech race attempt its value over the draws it could make, for passing Hypersonics' extra
 * play nothing (so it is on the cards' scale, and a card safe to play beats it), and for any other answer the board it
 * leaves (evaluate.ts). Ties go to the earlier answer.
 */
export function mediumAnswer(
  ruleset: Ruleset,
  view: PlayerView,
  side: Side,
  weights: MediumWeights,
  random: () => number,
): AnswerValue | null {
  if (!view.public.pending.some((decision) => decision.side === side)) return null;
  const hidden = guessHidden(ruleset, view, side, random);
  const state = reconstruct(view, hidden);
  let best: AnswerValue | null = null;
  let bestScore = -Infinity;
  for (const answer of legalAnswers(ruleset, state, side)) {
    const card = namedCard(ruleset, answer);
    const ops = card?.ops ?? 0;
    const rival = card !== null && card.affiliation !== "neutral" && card.affiliation !== side ? 1 : 0;
    let score = weights.ops * ops + weights.rivalCard * rival + weights.noise * random();
    if (card !== null) score += safetyScore(ruleset, view, side, card, answer, weights);
    else if (answer.kind === "chooseAction" && answer.action === "techRace") {
      score += attemptValue(ruleset, view, hidden, side, weights);
    } else if (answer.kind !== "pass")
      score += afterValue(ruleset, state, side, answer, weights, answer.kind === "chooseAction" ? 1 : 0);
    if (score > bestScore) {
      best = answer;
      bestScore = score;
    }
  }
  return best;
}
