// The turn structure (docs/design/core-loop.md). Each turn opens with both sides secretly picking a
// non-neutral card. Both are revealed together and their events resolve, more ops first. Then LIO
// and SAE take turns to play, until each has made `playsPerTurn` plays. After the setup's number of
// turns the game is over.
//
// TEMPORARY until the event-or-points play (#36): a play is a placeholder. The side picks any card in
// its hand, and it goes to the discard pile with no effect.
import { newDecision } from "./decisions.ts";
import { runProgram } from "./stack.ts";
import type { Budget, Closing } from "./stack.ts";
import type { CardId, EngineError, GameEvent, GameState, Ruleset, Side, Step } from "./types.ts";

/** The program each turn opens with: both sides secretly pick a card ("the both sides choose step"). */
const OPENING: Step[] = [{ op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "opening" }];

/** Opens the current turn: both sides' opening pick. Edits `state`, a working copy, in place. */
export const startTurn = (state: GameState, events: GameEvent[], budget: Budget): EngineError | null =>
  runProgram(state, OPENING, events, budget);

/**
 * Moves the game on once an answer has closed and the stack is empty: reveals the opening cards, or
 * makes a play, then runs on to the next decision (or the end of the game). Edits `state` in place.
 */
export function afterAnswer(
  ruleset: Ruleset,
  state: GameState,
  closing: Closing,
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
  if (closing.who === "both") {
    const { lio, sae } = closing.values;
    if (lio.kind === "chooseCard" && sae.kind === "chooseCard") {
      const error = revealOpening(ruleset, state, lio.card, sae.card, events, budget);
      if (error || state.public.stack.length > 0) return error;
    }
  } else if (closing.value.kind === "playCard") {
    playPlaceholder(state, closing.who, closing.value.card);
  }
  return settle(ruleset, state, events, budget);
}

/**
 * Both opening cards leave their hands for `inPlay`, in resolution order: more ops first, and on a
 * tie the card LIO picked, whichever side's card it is. Then the first card's event starts.
 */
function revealOpening(
  ruleset: Ruleset,
  state: GameState,
  lioPick: CardId,
  saePick: CardId,
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
  removeFromHand(state, "lio", lioPick);
  removeFromHand(state, "sae", saePick);
  const ops = (id: CardId) => cardOf(ruleset, id)?.ops ?? 0;
  state.public.inPlay = ops(saePick) > ops(lioPick) ? [saePick, lioPick] : [lioPick, saePick];
  return startEvent(ruleset, state, events, budget);
}

/**
 * Runs the game on while nothing waits on the stack. The first card in play has finished its event, so
 * it goes to the discard pile and the next card's event starts. With no card in play, the next side
 * plays; once both have made all their plays, the next turn opens, or after the last turn the game ends.
 */
function settle(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const pub = state.public;
  while (pub.stack.length === 0) {
    const finished = pub.inPlay.shift();
    if (finished !== undefined) {
      pub.discard.push(finished);
      const error = pub.inPlay.length > 0 ? startEvent(ruleset, state, events, budget) : null;
      if (error) return error;
    } else if (pub.playsMade < 2 * pub.playsPerTurn) {
      pub.pending = [newDecision(state.meta.seq, pub.playsMade % 2 === 0 ? "lio" : "sae", "playCard")];
      return null;
    } else if (pub.turn >= pub.turns) {
      pub.pending = [];
      pub.status = { kind: "over", winner: null, reason: "turnLimitReached" };
      return null;
    } else {
      pub.turn += 1;
      pub.playsMade = 0;
      const error = startTurn(state, events, budget);
      if (error) return error;
    }
  }
  return null;
}

/** Starts the event of the first card in play. Its choices go to whichever side the card names. */
function startEvent(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const card = cardOf(ruleset, state.public.inPlay[0]!);
  return runProgram(state, card?.effect ?? [], events, budget);
}

/** TEMPORARY placeholder play (see the top of this file): the card goes to the discard pile. */
function playPlaceholder(state: GameState, side: Side, card: CardId): void {
  removeFromHand(state, side, card);
  state.public.discard.push(card);
  state.public.playsMade += 1;
}

function removeFromHand(state: GameState, side: Side, card: CardId): void {
  state.private[side].hand = state.private[side].hand.filter((id) => id !== card);
}

const cardOf = (ruleset: Ruleset, id: CardId) => ruleset.cards.find((card) => card.id === id);
