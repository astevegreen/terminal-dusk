// The fuzz checks of the removed pile (R8a; #205) and of the turn-start refill, each comparing the state after a
// step with the state before it. play.ts runs them after every answer; each throws an Error saying what is wrong.
import { SIDES } from "@terminal-dusk/engine";
import type { Answer, CardId, GameState, Ruleset, Setup, Side } from "@terminal-dusk/engine";

/**
 * The removed pile after a step: (a) it only grows, keeping its order, so a card never leaves it; (b) every card
 * in it is flagged removeAfterEvent; (c) a card added in this step had its event run. That is: it was in `inPlay`
 * before the step with a player in `inPlayBy` (R8a's record of an event that runs, a rival's card played for its
 * points included; null for a play for points only), or it was picked to open the turn (by this step's answer or
 * an earlier pick still unrevealed), or this step's answer played it for its event, or played the rival's card
 * for its points. An own or neutral card played for its points only never leaves the game.
 */
export function checkRemoved(ruleset: Ruleset, prior: GameState, answer: Answer, state: GameState): void {
  const before = prior.public.removed;
  const after = state.public.removed;
  if (JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before)) {
    throw new Error(`the removed pile ${JSON.stringify(after)} does not start with ${JSON.stringify(before)}`);
  }
  for (const card of after) {
    if (ruleset.cards.find((c) => c.id === card)?.flags?.removeAfterEvent !== true) {
      throw new Error(`${card} is in the removed pile, but is not flagged removeAfterEvent`);
    }
  }
  for (const card of after.slice(before.length)) {
    if (!eventRan(ruleset, prior, answer, card)) {
      throw new Error(`${card} left the game in this step, but its event did not run`);
    }
  }
}

/** Whether `card`'s event ran, by the record in `prior` (the state before the step) or this step's `answer`. */
function eventRan(ruleset: Ruleset, prior: GameState, answer: Answer, card: CardId): boolean {
  const at = prior.public.inPlay.indexOf(card);
  if (at >= 0) return (prior.public.inPlayBy[at] ?? null) !== null;
  const picked = [prior.private.lio, prior.private.sae].flatMap((p) => p.picks.map((pick) => pick.value));
  const value = "value" in answer ? answer.value : null;
  if ([...picked, value].some((v) => v?.kind === "chooseCard" && v.card === card)) return true;
  if (value?.kind !== "playCardAs" || value.card !== card) return false;
  return value.as === "event" || isRivals(ruleset, card, answer.side);
}

/** Whether `card` belongs to the rival of `side`: a card of the other side, never a neutral card. */
function isRivals(ruleset: Ruleset, card: CardId, side: Side): boolean {
  const affiliation = ruleset.cards.find((c) => c.id === card)?.affiliation;
  return affiliation !== undefined && affiliation !== "neutral" && affiliation !== side;
}

/**
 * After a step in which the turn number went up, the turn-start refill has just run and no card has been played
 * yet (the opening picks are still pending), so both hands hold at least the hand size; a refill only tops up, so
 * a hand dealt more by the setup may hold more. Other steps, and the step that ends the game, are not checked:
 * hands shrink during play, and no turn opens after the last.
 */
export function checkRefilled(setup: Setup, prior: GameState, state: GameState): void {
  if (state.public.turn <= prior.public.turn || state.public.status.kind !== "active") return;
  for (const side of SIDES) {
    const held = state.private[side].hand.length;
    if (held < setup.handSize) {
      throw new Error(
        `turn ${state.public.turn} opened with ${side} holding ${held} cards, not the hand size ${setup.handSize}`,
      );
    }
  }
}
