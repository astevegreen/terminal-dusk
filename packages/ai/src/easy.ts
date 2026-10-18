// The Easy tier (docs/architecture.md, Decision 8): score every legal answer with a small evaluation
// plus random noise, and take the best. It sees only its own view and guesses the rest.
import { legalAnswers, reconstruct } from "@terminal-dusk/engine";
import type { AnswerValue, CardDef, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { guessHidden } from "./guess.ts";
import type { Weights } from "./types.ts";

/** The card an answer names, or null for an answer that names none. */
function namedCard(ruleset: Ruleset, value: AnswerValue): CardDef | null {
  if (value.kind !== "chooseCard" && value.kind !== "playCardAs") return null;
  return ruleset.cards.find((card) => card.id === value.card) ?? null;
}

/**
 * The best-scoring legal answer for `side`, or null when nothing is pending for it. A score is
 * `ops * printed ops + rivalCard * (1 if the card is the rival's) + noise * random()`; ties go to the
 * earlier answer. Answers that name no card depend on the noise alone.
 */
export function easyAnswer(
  ruleset: Ruleset,
  view: PlayerView,
  side: Side,
  weights: Weights,
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
    const score = weights.ops * ops + weights.rivalCard * rival + weights.noise * random();
    if (score > bestScore) {
      best = answer;
      bestScore = score;
    }
  }
  return best;
}
