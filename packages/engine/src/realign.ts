// Spending points on realigning (R16c, #317; docs/design/map-and-points.md, "Points and actions" 2). Each point
// buys one attempt, and each attempt may pick a different country where the rival has influence; no adjacency is
// needed. In an attempt each side draws one card from its own Contingency deck, the acting side first
// (contingency-deck.md, "Realignments"), and adds 1 per adjacent country it controls, 1 if it has more influence in
// the country, and 1 if its home box touches it. The higher total removes the difference from the loser's
// influence there, stopping at 0; a tie changes nothing (owner, 26 Oct, #317, "approved as recommended"). The side
// picks each attempt's country in a realign decision (hard rule 4), and may stop early instead (owner, 26 Oct,
// #317 review): the attempts left are not made.
import { drawContingency } from "./contingency.ts";
import { newRealignDecision } from "./decisions.ts";
import { controller, realignTargets, removeInfluence } from "./influence.ts";
import { otherSide } from "./types.ts";
import type { CountryId, EngineError, Frame, GameEvent, GameState, PublicState, Side } from "./types.ts";

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

/**
 * `side`'s bonus in a realignment in `country`, as the state is now: 1 per adjacent country it controls, 1 if
 * it has more influence there than the rival, and 1 if its home box touches the country. 0 without a map.
 */
export function realignBonus(state: PublicState, side: Side, country: CountryId): number {
  const def = state.map?.countries.find((c) => c.id === country);
  const entry = state.influence?.find((e) => e.country === country);
  if (state.map === undefined || def === undefined || entry === undefined) return 0;
  const adjacent = def.neighbours.filter((id) => controller(state, id) === side).length;
  const more = entry[side] > entry[otherSide(side)] ? 1 : 0;
  const home = state.map.homeBox[side].includes(country) ? 1 : 0;
  return adjacent + more + home;
}

/**
 * Asks `side` for the country of its next attempt, with `attempts` left, while the rival has influence
 * somewhere; otherwise clears the pending decision and moves the frame past its spendPoints step.
 */
export function offerRealign(state: GameState, frame: Frame, side: Side, attempts: number): "ran" | "paused" {
  const targets = realignTargets(state.public, side);
  if (attempts > 0 && targets.length > 0) {
    state.public.pending = [newRealignDecision(state.meta.seq, side, attempts, targets)];
    return "paused";
  }
  state.public.pending = [];
  frame.next += 1;
  return "ran";
}

/**
 * Resumes the top frame, paused at a spendPoints step, with the country picked for a realignment (apply has
 * checked it against legalAnswers): the attempt is made, then the next one is asked for, or the frame moves on.
 * `country` null stops: the attempts left are not made and the frame moves on. Anything else on top of the stack
 * is a broken program.
 */
export function resumeRealign(state: GameState, country: CountryId | null, events: GameEvent[]): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const decision = state.public.pending[0];
  if (!frame || step?.op !== "spendPoints" || decision?.kind !== "realign" || !("attempts" in decision.options)) {
    return invalidProgram("The stack is not paused at a realignment.");
  }
  const side = decision.side;
  if (country === null) {
    offerRealign(state, frame, side, 0);
    return null;
  }
  if (!realignTargets(state.public, side).includes(country)) {
    return invalidProgram("The rival has no influence there to realign.");
  }
  realign(state, side, country, events);
  offerRealign(state, frame, side, decision.options.attempts - 1);
  return null;
}

/** One attempt by `side` in `country`: both draws, both totals, and the loser's influence lowered. */
function realign(state: GameState, side: Side, country: CountryId, events: GameEvent[]): void {
  const rival = otherSide(side);
  const own = drawContingency(state, side, events);
  const theirs = drawContingency(state, rival, events);
  const ownTotal = own + realignBonus(state.public, side, country);
  const rivalTotal = theirs + realignBonus(state.public, rival, country);
  const totals = side === "lio" ? { lio: ownTotal, sae: rivalTotal } : { lio: rivalTotal, sae: ownTotal };
  const difference = Math.abs(ownTotal - rivalTotal);
  let loser: Side | null = null;
  if (ownTotal !== rivalTotal) loser = ownTotal > rivalTotal ? rival : side;
  let removed = 0;
  if (loser !== null) {
    const before = state.public.influence?.find((e) => e.country === country)?.[loser] ?? 0;
    const influence = removeInfluence(state, loser, country, difference).public.influence;
    if (influence !== undefined) state.public.influence = influence;
    removed = Math.min(before, difference);
  }
  events.push({ kind: "realigned", visibility: "public", side, country, totals, loser, removed });
}
