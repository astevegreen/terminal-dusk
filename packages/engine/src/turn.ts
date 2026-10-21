// The turn structure (docs/design/core-loop.md). Each turn opens with both hands refilled to the hand
// size, then both sides secretly picking a card, a neutral one too. Both are revealed together and their
// events resolve, more ops first. Then LIO and SAE take turns to play, until each has made
// `playsPerTurn` plays. After the setup's number of turns the game is over.
//
// A play uses a card for its event or its points (decisions.ts lists the uses each card allows). A
// rival's card is played for its points, and its event still happens: the player first says whether
// before or after the points. A played card stays in `inPlay` until everything it triggered is done, then
// goes to the discard pile, or out of the game if it is flagged removeAfterEvent and its event ran (putAway).
import { newDecision, whoseCard } from "./decisions.ts";
import { enterEra } from "./eras.ts";
import { forgetCard } from "./knowledge.ts";
import { refillHands } from "./refill.ts";
import { endTurnModifiers } from "./modifiers.ts";
import { runProgram, runStack } from "./stack.ts";
import type { Budget, Closing } from "./stack.ts";
import { endTurnTriggers, fireTurnEnd } from "./triggers.ts";
import { otherSide } from "./types.ts";
import type { AnswerValue, CardId, EngineError, GameEvent, GameState, Ruleset, Side, Step } from "./types.ts";

/** The program each turn opens with: both sides secretly pick a card ("the both sides choose step"). */
const OPENING: Step[] = [{ op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "opening" }];

/**
 * Opens the current turn: an era entering on it is shuffled into the draw pile, both hands are refilled
 * to the hand size (refill.ts), then both sides make their opening pick. Edits `state`, a working copy, in place.
 */
export function startTurn(state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  enterEra(state, events);
  refillHands(state, events);
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
 * tie the card LIO picked, whichever side's card it is. `inPlayBy` records who picked each, so the
 * second card's event, which may start in a later call, still knows its picker. Then the first starts.
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
  const saeFirst = ops(saePick) > ops(lioPick);
  state.public.inPlay = saeFirst ? [saePick, lioPick] : [lioPick, saePick];
  state.public.inPlayBy = saeFirst ? ["sae", "lio"] : ["lio", "sae"];
  return startEvent(ruleset, state, events, budget);
}

/**
 * Runs the game on while nothing waits on the stack. The first card in play has finished its event (and
 * any reactions to it), so it leaves play (putAway) and the next card's event starts. With no card in
 * play, the next side plays. Once both have made all their plays, the turnEnd hook fires; when its
 * reactions have finished, the turn ends.
 */
function settle(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const pub = state.public;
  while (pub.stack.length === 0 && pub.status.kind === "active") {
    const finished = pub.inPlay.shift();
    const player = pub.inPlayBy.shift();
    let error: EngineError | null = null;
    if (finished !== undefined) {
      putAway(ruleset, state, finished, player ?? null);
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
 * Where a finished card goes. A card flagged removeAfterEvent whose event ran leaves the game for `removed`
 * (owner, 21 Oct): played for its event, an opening pick, or a rival's card played for its points, whose event
 * still runs. `player`, from `inPlayBy`, is null only for a play for points with no event (play, below); such
 * a play, and every unflagged card, goes to the discard pile.
 */
function putAway(ruleset: Ruleset, state: GameState, card: CardId, player: Side | null): void {
  const leaves = player !== null && cardOf(ruleset, card)?.flags?.removeAfterEvent === true;
  (leaves ? state.public.removed : state.public.discard).push(card);
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

/**
 * Starts the event of the first card in play, with the side that picked it as its `player`. Its choices
 * go to whichever side the card names.
 */
function startEvent(ruleset: Ruleset, state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const id = state.public.inPlay[0]!;
  const player = state.public.inPlayBy[0] ?? undefined;
  return runCard(ruleset, state, cardOf(ruleset, id)?.effect ?? [], id, player, { events, budget });
}

/**
 * Runs `steps` for card `id`, picked or played by `player`. When `player` plays the rival's card, the
 * program records the card's owner as `worldFor`, so its draws from that deck use the World deck.
 */
function runCard(
  ruleset: Ruleset,
  state: GameState,
  steps: Step[],
  id: CardId,
  player: Side | undefined,
  run: { events: GameEvent[]; budget: Budget },
): EngineError | null {
  const card = cardOf(ruleset, id);
  const rival = player !== undefined && whoseCard(card, player) === "rival";
  const worldFor = rival ? otherSide(player) : undefined;
  return runProgram(state, steps, run.events, run.budget, id, player, worldFor);
}

/**
 * `side` plays a card: it leaves the hand for `inPlay` at once. Your own card or a neutral card runs its
 * event or spends its points; a rival's card waits for its rivalEventOrder answer. An event records
 * `side` as its player (a rival's card always has its event); a play for points with no event records
 * nothing (null in `inPlayBy`).
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
  const card = cardOf(ruleset, value.card);
  const rival = whoseCard(card, side) === "rival";
  const player = rival || value.as === "event" ? side : null;
  state.public.inPlay = [value.card];
  state.public.inPlayBy = [player];
  state.public.playsMade += 1;
  if (rival) {
    state.public.pending = [newDecision(state.meta.seq, side, "rivalEventOrder")];
    return null;
  }
  const steps = value.as === "event" ? (card?.effect ?? []) : [spendPoints(side, card?.ops ?? 0)];
  return runCard(ruleset, state, steps, value.card, player ?? undefined, { events, budget });
}

/**
 * The rival's card in play, played by `side` for its points: its event runs before or after the points.
 * Each choice in the event goes to the side its `choose` step names, never to `side` as such. The event
 * records `side` as its player.
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
  const steps = event === "before" ? [...effect, points] : [points, ...effect];
  return runCard(ruleset, state, steps, id, side, { events, budget });
}

/** True while a rival's card is in play and its player has yet to say when its event happens. */
const waitsForOrder = (state: GameState): boolean => state.public.pending.some((d) => d.kind === "rivalEventOrder");

const spendPoints = (side: Side, amount: number): Step => ({ op: "spendPoints", side, amount });

/** `card` leaves `side`'s hand, and so the rival's knowledge (knowledge.ts). */
function removeFromHand(state: GameState, side: Side, card: CardId): void {
  state.private[side].hand = state.private[side].hand.filter((id) => id !== card);
  forgetCard(state, side, card);
}

const cardOf = (ruleset: Ruleset, id: CardId) => ruleset.cards.find((card) => card.id === id);
