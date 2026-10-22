// The fuzz check for knowledge and shown hands (R6a, #185): what each side knows of the rival's hand always
// matches the real hand, and a shown hand reaches only the peeking side. checkStep (checks.ts) runs it on the real
// game state after every step, never on an AI's guessed state.
import { eventsFor, SIDES } from "@terminal-dusk/engine";
import type { CardId, GameEvent, GameState, HandRevealed, Side, Viewer } from "@terminal-dusk/engine";

/** Each side's knowledge before a step; null for the state createGame made. */
export type KnowledgeBefore = Readonly<Record<Side, readonly CardId[]>> | null;

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");
const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];
const shown = (value: unknown): string => JSON.stringify(value);

/** Each side's knowledge now, for the next step's check. */
export const knowledgeOf = (state: GameState): KnowledgeBefore => ({
  lio: state.private.lio.knowledge,
  sae: state.private.sae.knowledge,
});

/** The cards `side` drew in `events` from index `from` on. */
const drawnFrom = (events: readonly GameEvent[], from: number, side: Side): CardId[] =>
  events.slice(from).flatMap((e) => (e.kind === "cardDrawn" && e.side === side ? [e.card] : []));

/**
 * Knowledge and shown hands after one step (`events` are its events, `before` each side's knowledge before it):
 * (a) each side's knowledge holds no card twice and only cards in the rival's hand now; (b) every card a
 * handRevealed event shows is in the peeking side's knowledge now, unless it left the rival's hand later in the
 * step (it is not in the hand now, or the rival drew it again after the reveal); (c) the cards known before the step
 * that are still in the rival's hand, and not drawn again in the step, are still known, in the same order; (d) each
 * handRevealed goes only to the peeking side, and everyone else gets a handRevealedHidden with its card count.
 */
export function checkKnowledge(state: GameState, events: readonly GameEvent[], before: KnowledgeBefore): void {
  for (const side of SIDES) {
    const known = state.private[side].knowledge;
    const hand = state.private[other(side)].hand;
    const twice = known.filter((card, i) => known.indexOf(card) !== i);
    if (twice.length > 0) throw new Error(`${side}'s knowledge ${shown(known)} holds ${shown(twice)} more than once`);
    const stale = known.filter((card) => !hand.includes(card));
    if (stale.length > 0) {
      throw new Error(
        `${side}'s knowledge holds ${shown(stale)}, which are not in ${other(side)}'s hand ${shown(hand)}`,
      );
    }
    if (before !== null) checkKept(side, before[side], known, hand, drawnFrom(events, 0, other(side)));
  }
  events.forEach((event, i) => {
    if (event.kind !== "handRevealed") return;
    checkRevealSent(event, i);
    const peeker = other(event.side);
    const redrawn = drawnFrom(events, i + 1, event.side);
    const hand = state.private[event.side].hand;
    const known = state.private[peeker].knowledge;
    const lost = event.cards.filter((c) => hand.includes(c) && !redrawn.includes(c) && !known.includes(c));
    if (lost.length > 0) {
      throw new Error(
        `event ${i} showed ${peeker} ${shown(lost)}, still in ${event.side}'s hand, but ${peeker} does not know them`,
      );
    }
  });
}

/** (c): the cards `side` knew before that are still in the rival's hand, and not drawn again, are still known in order. */
function checkKept(
  side: Side,
  before: readonly CardId[],
  known: readonly CardId[],
  hand: readonly CardId[],
  redrawn: readonly CardId[],
): void {
  const kept = before.filter((card) => hand.includes(card) && !redrawn.includes(card));
  const stillKnown = known.filter((card) => kept.includes(card));
  if (shown(stillKnown) === shown(kept)) return;
  throw new Error(
    `${side} knew ${shown(kept)} before the step, still in ${other(side)}'s hand, but now knows them as ${shown(stillKnown)}`,
  );
}

/** (d): handRevealed event `i` reaches only the peeking side; everyone else gets only its card count. */
function checkRevealSent(event: HandRevealed, i: number): void {
  const peeker = other(event.side);
  if (event.visibility !== peeker) {
    throw new Error(
      `event ${i} shows ${event.side}'s hand to '${event.visibility}', not to the peeking side ${peeker}`,
    );
  }
  for (const viewer of VIEWERS) {
    if (viewer === peeker) continue;
    const seen = eventsFor([event], viewer);
    const hidden = { kind: "handRevealedHidden", visibility: "public", side: event.side, cards: event.cards.length };
    if (shown(seen) !== shown([hidden])) {
      throw new Error(`event ${i}: '${viewer}' gets ${shown(seen)} for a shown hand, not only ${shown(hidden)}`);
    }
  }
}
