// The turn structure (docs/design/core-loop.md). Each turn opens with both sides secretly picking a
// card, a neutral one too. Both are revealed together and their events resolve, more ops first. Then LIO
// and SAE take turns to play, until each has made `playsPerTurn` plays. After the setup's number of
// turns the game is over.
//
// A play uses a card for its event or its points (decisions.ts lists the uses each card allows). A
// rival's card is played for its points, and its event still happens: the player first says whether
// before or after the points. A played card stays in `inPlay` until everything it triggered is done.
import { newDecision, whoseCard } from "./decisions.ts";
import { enterEra } from "./eras.ts";
import { endTurnModifiers } from "./modifiers.ts";
import { runProgram, runStack } from "./stack.ts";
import type { Budget, Closing } from "./stack.ts";
import { endTurnTriggers, fireTurnEnd } from "./triggers.ts";
import type { AnswerValue, CardId, EngineError, GameEvent, GameState, Ruleset, Side, Step } from "./types.ts";

/** The program each turn opens with: both sides secretly pick a card ("the both sides choose step"). */
const OPENING: Step[] = [{ op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "opening" }];

/**
 * Opens the current turn: an era entering on it is shuffled into the draw pile, then both sides make
 * their opening pick. Edits `state`, a working copy, in place.
 */
export function startTurn(state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  enterEra(state, events);
  return runProgram(state, OPENING, events, budget);
}

/**
 * Moves the game on once an answer has closed and the stack is empty: reveals the opening cards, or
 * makes a play, then runs on to the next decision (or the end of the game). A play of a rival's card
 * first waits for its rivalEventOrder answer. Edits `state` in place.
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
  } else if (closing.value.kind === "playCardAs") {
    const error = play(ruleset, state, closing.who, closing.value, events, budget);
    if (error || state.public.stack.length > 0 || waitsForOrder(state)) return error;
  } else if (closing.value.kind === "rivalEventOrder") {
    const error = playRival(ruleset, state, closing.who, closing.value.event, events, budget);
    if (error || state.public.stack.length > 0) return error;
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
 * Runs the game on while nothing waits on the stack. The first card in play has finished its event (and
 * any reactions to it), so it goes to the discard pile and the next card's event starts. With no card in
 * play, the next side plays. Once both have made all their plays, the turnEnd hook fires; when its
 * reactions have finished, the turn ends.
 */
function settle(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const pub = state.public;
  while (pub.stack.length === 0 && pub.status.kind === "active") {
    const finished = pub.inPlay.shift();
    let error: EngineError | null = null;
    if (finished !== undefined) {
      pub.discard.push(finished);
      if (pub.inPlay.length > 0) error = startEvent(ruleset, state, events, budget);
    } else if (pub.playsMade < 2 * pub.playsPerTurn) {
      pub.pending = [newDecision(state.meta.seq, pub.playsMade % 2 === 0 ? "lio" : "sae", "playCardAs")];
      return null;
    } else if (pub.turnEndFired) {
      error = endTurn(state, events, budget);
    } else {
      fireTurnEnd(state, events);
      error = runStack(state, events, budget);
    }
    if (error) return error;
  }
  return null;
}

/**
 * The turn ends: the triggers and modifiers lasting until then end first, then the next turn opens, or
 * after the last turn the game is over.
 */
function endTurn(state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const pub = state.public;
  endTurnTriggers(state, events);
  endTurnModifiers(state, events);
  if (pub.turn >= pub.turns) {
    pub.pending = [];
    pub.status = { kind: "over", winner: null, reason: "turnLimitReached" };
    return null;
  }
  pub.turn += 1;
  pub.playsMade = 0;
  pub.turnEndFired = false;
  return startTurn(state, events, budget);
}

/** Starts the event of the first card in play. Its choices go to whichever side the card names. */
function startEvent(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const id = state.public.inPlay[0]!;
  return runProgram(state, cardOf(ruleset, id)?.effect ?? [], events, budget, id);
}

/**
 * `side` plays a card: it leaves the hand for `inPlay` at once. Your own card or a neutral card runs its
 * event or spends its points; a rival's card waits for its rivalEventOrder answer.
 */
function play(
  ruleset: Ruleset,
  state: GameState,
  side: Side,
  value: Extract<AnswerValue, { kind: "playCardAs" }>,
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
  removeFromHand(state, side, value.card);
  state.public.inPlay = [value.card];
  state.public.playsMade += 1;
  const card = cardOf(ruleset, value.card);
  if (whoseCard(card, side) === "rival") {
    state.public.pending = [newDecision(state.meta.seq, side, "rivalEventOrder")];
    return null;
  }
  const steps = value.as === "event" ? (card?.effect ?? []) : [spendPoints(side, card?.ops ?? 0)];
  return runProgram(state, steps, events, budget, value.card);
}

/**
 * The rival's card in play, played by `side` for its points: its event runs before or after the points.
 * Each choice in the event goes to the side its `choose` step names, never to `side` as such.
 */
function playRival(
  ruleset: Ruleset,
  state: GameState,
  side: Side,
  event: "before" | "after",
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
  const id = state.public.inPlay[0]!;
  const card = cardOf(ruleset, id);
  const effect = card?.effect ?? [];
  // The printed ops: the modifiers in force when this step runs change them, its own event's included.
  const points = spendPoints(side, card?.ops ?? 0);
  return runProgram(state, event === "before" ? [...effect, points] : [points, ...effect], events, budget, id);
}

/** True while a rival's card is in play and its player has yet to say when its event happens. */
const waitsForOrder = (state: GameState): boolean => state.public.pending.some((d) => d.kind === "rivalEventOrder");

const spendPoints = (side: Side, amount: number): Step => ({ op: "spendPoints", side, amount });

function removeFromHand(state: GameState, side: Side, card: CardId): void {
  state.private[side].hand = state.private[side].hand.filter((id) => id !== card);
}

const cardOf = (ruleset: Ruleset, id: CardId) => ruleset.cards.find((card) => card.id === id);
