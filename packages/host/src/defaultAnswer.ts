// The default answer: what the host answers for a late side under the "defaultAnswer" deadline rule (option C of
// docs/proposals/missed-turn-ai.md; owner, 21 Nov 2026, in chat: "Take all"). Pass where the rules allow it,
// otherwise the cheapest legal answer. It only ever picks from the engine's own legalAnswers.
import { legalAnswers, pendingFor, placementCost } from "@terminal-dusk/engine";
import type { AnswerValue, CardId, CountryId, DecisionKind, GameState, Ruleset, Side } from "@terminal-dusk/engine";

/** What the chooser needs to know beyond the legal answers: a card's printed points and a placement's cost. */
export type Costs = { opsOf: (card: CardId) => number; costOf: (country: CountryId) => number };

/** The default answer for `side`'s waiting decision, or null when nothing waits for it. */
export function defaultAnswer(ruleset: Ruleset, state: GameState, side: Side): AnswerValue | null {
  const decision = pendingFor(state, side);
  if (decision === null) return null;
  const costs: Costs = {
    opsOf: (card) => ruleset.cards.find((c) => c.id === card)?.ops ?? 0,
    costOf: (country) => placementCost(state.public, side, country) ?? Number.MAX_SAFE_INTEGER,
  };
  return chooseDefault(decision.kind, legalAnswers(ruleset, state, side), costs);
}

/**
 * The default among `legal`, the engine's answers to a decision of `kind`, in the engine's order. Ties always go
 * to the earliest answer in that order (hand order, map order). Per kind:
 * - extraPlay: pass. realign: stop (country null). yesNo: no. rivalEventOrder: before.
 * - chooseAction: pass if offered; else realign (whose next decision then stops at once, leaving the points
 *   unspent); else place; else the first intervention target.
 * - placeInfluence: the cheapest country (1 point before 2).
 * - chooseCard: the card with the fewest printed points. playCardAs: that card, played for its points (when no play
 *   for points is offered, the cheapest legal play).
 * - discardCards: the cards with the fewest printed points, from whichever hand the discard takes.
 * Null only when `legal` is empty.
 */
export function chooseDefault(kind: DecisionKind, legal: readonly AnswerValue[], costs: Costs): AnswerValue | null {
  const find = (match: (a: AnswerValue) => boolean): AnswerValue | undefined => legal.find(match);
  switch (kind) {
    case "extraPlay":
      return find((a) => a.kind === "pass") ?? legal[0] ?? null;
    case "realign":
      return find((a) => a.kind === "realign" && a.country === null) ?? legal[0] ?? null;
    case "yesNo":
      return find((a) => a.kind === "yesNo" && !a.yes) ?? legal[0] ?? null;
    case "rivalEventOrder":
      return find((a) => a.kind === "rivalEventOrder" && a.event === "before") ?? legal[0] ?? null;
    case "chooseAction":
      return chooseAction(legal);
    case "placeInfluence":
      return cheapest(legal, (a) => (a.kind === "placeInfluence" ? costs.costOf(a.country) : Infinity));
    case "chooseCard":
      return cheapest(legal, (a) => (a.kind === "chooseCard" ? costs.opsOf(a.card) : Infinity));
    case "playCardAs": {
      const ops = (a: AnswerValue): number => (a.kind === "playCardAs" ? costs.opsOf(a.card) : Infinity);
      const forPoints = legal.filter((a) => a.kind === "playCardAs" && a.as === "points");
      return cheapest(forPoints.length > 0 ? forPoints : legal, ops);
    }
    case "discardCards":
      return cheapest(legal, (a) => (a.kind === "discardCards" ? sum(a.cards.map(costs.opsOf)) : Infinity));
  }
}

const ACTION_ORDER = ["pass", "realign", "place", "intervene"] as const;

function chooseAction(legal: readonly AnswerValue[]): AnswerValue | null {
  for (const action of ACTION_ORDER) {
    const answer = legal.find((a) => a.kind === "chooseAction" && a.action === action);
    if (answer) return answer;
  }
  return legal[0] ?? null;
}

/** The first answer with the lowest cost, or null for an empty list. */
function cheapest(legal: readonly AnswerValue[], cost: (a: AnswerValue) => number): AnswerValue | null {
  let best: AnswerValue | null = null;
  let bestCost = Infinity;
  for (const answer of legal) {
    const c = cost(answer);
    if (best === null || c < bestCost) [best, bestCost] = [answer, c];
  }
  return best;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
