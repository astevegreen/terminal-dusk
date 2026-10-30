// The Hard tier (docs/architecture.md, Decision 8): for a card choice, Medium's best few answers are each played out a
// few card plays ahead (rollout.ts) on many guesses of what it cannot see, and the one with the best average wins.
// Every other decision is answered as Medium would, with Hard's weights. Sees only its own view and guesses the rest.
// The search's size is a count (guesses times candidates), so a seed and a view always give the same answer; a clock,
// when one is passed in, can only stop it early. The package never reads a clock itself.
import { reconstruct } from "@terminal-dusk/engine";
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { guessHidden } from "./guess.ts";
import { bestScored, scoredAnswers } from "./medium.ts";
import type { Scored } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { rollout } from "./rollout.ts";
import type { HardWeights } from "./types.ts";

/** Milliseconds from some fixed moment; only differences are used. */
export type Clock = () => number;

/** The answers a search tries: playing a card, or passing up Hypersonics' extra play. */
const searched = (answer: AnswerValue): boolean =>
  answer.kind === "chooseCard" || answer.kind === "playCardAs" || answer.kind === "pass";

/** `scored`'s answers from Medium's best to worst; ties keep their legal-answer order. */
const byScore = (scored: readonly Scored[]): AnswerValue[] =>
  scored
    .map((entry, i) => ({ ...entry, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((entry) => entry.answer);

/**
 * Hard's answer for `side`, or null when nothing is pending for it. A decision whose answers are not all card plays
 * or passes gets Medium's answer. Otherwise the top `weights.candidates` answers by Medium's score are each played out
 * (rollout) on `weights.guesses` guessed hidden parts, guess by guess, every candidate on a guess facing the same luck.
 * The best average over the finished guesses wins, ties going to Medium's order; with no finished guess, Medium's
 * best. With `now`, the search stops once `weights.timeMs` milliseconds have passed, dropping a half-finished guess.
 */
export function hardAnswer(
  ruleset: Ruleset,
  view: PlayerView,
  side: Side,
  weights: HardWeights,
  random: () => number,
  now?: Clock,
): AnswerValue | null {
  const scored = scoredAnswers(ruleset, view, side, weights, random);
  if (scored === null) return null;
  if (!scored.every((entry) => searched(entry.answer))) return bestScored(scored);
  const candidates = byScore(scored).slice(0, weights.candidates);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const started = now?.() ?? 0;
  const outOfTime = (): boolean => now !== undefined && now() - started >= weights.timeMs;
  const totals = candidates.map(() => 0);
  let finished = 0;
  search: for (let g = 0; g < weights.guesses; g++) {
    if (outOfTime()) break;
    const luck = Math.floor(random() * 0x1_0000_0000);
    const state = reconstruct(view, guessHidden(ruleset, view, side, random));
    const values: number[] = [];
    for (const candidate of candidates) {
      if (outOfTime()) break search;
      values.push(rollout(ruleset, state, side, candidate, weights, weights.rounds, seededRandom(luck)).value);
    }
    values.forEach((value, i) => (totals[i] = totals[i]! + value));
    finished++;
  }
  if (finished === 0) return candidates[0]!;
  let top = 0;
  for (let i = 1; i < candidates.length; i++) if (totals[i]! > totals[top]!) top = i;
  return candidates[top]!;
}
