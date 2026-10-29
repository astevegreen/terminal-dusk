// The Medium tier's Escalation safety (docs/design/map-and-points.md, "Escalation"): a raise to 6 is a crisis that
// costs the side that caused it the number it draws from its own Contingency deck, so Medium never makes one itself.
// Uses the cards it has not seen to tell whether a high Escalation is a danger to the rival (unseen.ts).
import type { AnswerValue, CardDef, PlayerView, PublicState, Ruleset, Side } from "@terminal-dusk/engine";
import { escalationEffect, unseenCards } from "./unseen.ts";
import type { MediumWeights } from "./types.ts";

const ESCALATION_MAX = 6;
/** The draw a deck with nothing left to go on would give, on average (draws run 1 to 6). */
const DEFAULT_DRAW = 3.5;

/** Whether the card's event runs when `answer` names it: an opening pick, a played event, or a rival's card played for points. */
function eventRuns(card: CardDef, answer: AnswerValue, side: Side): boolean {
  if (answer.kind === "chooseCard") return true;
  if (answer.kind !== "playCardAs") return false;
  return answer.as === "event" || (card.affiliation !== "neutral" && card.affiliation !== side);
}

/** What a crisis `side` caused is expected to cost: the mean of the numbers left in its Contingency deck. */
export function expectedCrisisCost(view: PlayerView, side: Side): number {
  return crisisCost(view.public, side);
}

/** The same from the public state alone, for a state Medium has simulated. */
export function crisisCost(pub: PublicState, side: Side): number {
  const left = pub.contingency[side].left;
  return left.length === 0 ? DEFAULT_DRAW : left.reduce((a, b) => a + b, 0) / left.length;
}

/**
 * The share (0 to 1) of the cards `side` has not seen, other than its own, whose event would raise Escalation from
 * `level` to 6: the chance a card of the rival's is a trap for it.
 */
export function crisisShare(ruleset: Ruleset, view: PlayerView, side: Side, level: number): number {
  const pool = unseenCards(ruleset, view).filter((c) => c.affiliation !== side);
  if (pool.length === 0) return 0;
  return pool.filter((c) => level + escalationEffect(c).up >= ESCALATION_MAX).length / pool.length;
}

/**
 * The safety score of an answer that names `card`: a large loss when its event would raise Escalation to 6 and so
 * give `side` a crisis; otherwise a small gain when it leaves Escalation where much of what the rival has not
 * played would make a crisis for the rival, and none of `side`'s own other cards would for `side`.
 */
export function safetyScore(
  ruleset: Ruleset,
  view: PlayerView,
  side: Side,
  card: CardDef,
  answer: AnswerValue,
  weights: MediumWeights,
): number {
  const level = view.public.escalation;
  if (level === undefined || !eventRuns(card, answer, side)) return 0;
  const { up, down } = escalationEffect(card);
  if (up === 0) return 0;
  if (level + up >= ESCALATION_MAX) return -weights.crisis * expectedCrisisCost(view, side);
  const after = Math.max(0, level + up - down);
  const ownTrap = (view.mine?.hand ?? []).some((id) => {
    const other = ruleset.cards.find((c) => c.id === id);
    return id !== card.id && other !== undefined && after + escalationEffect(other).up >= ESCALATION_MAX;
  });
  return ownTrap ? 0 : weights.trap * crisisShare(ruleset, view, side, after);
}
