// Running a discardFromHand step (#186, #192). Without `chosenBy` the cards are picked at random (discard.ts).
// With it, a side picks them in a discardCards decision (hard rule 4): the hand's owner, or the side that played
// the card, which first sees the whole hand as with revealHand. The answer resumes the paused step.
import { newDiscardDecision } from "./decisions.ts";
import { discardChosen, discardFromHand } from "./discard.ts";
import { revealHand } from "./knowledge.ts";
import type { CardId, EngineError, Frame, GameEvent, GameState, Side, Step } from "./types.ts";

type DiscardStep = Extract<Step, { op: "discardFromHand" }>;

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

/**
 * Runs `step`, the top frame's next step. `player` is the running program's recorded player, if any. A random
 * discard, or a hand of `count` cards or fewer, is done at once and the frame moves on ("ran"). Otherwise the
 * picker's discardCards decision becomes the pending one and the frame stays at this step ("paused"). A
 * "player" pick with no recorded player is a broken program.
 */
export function runDiscard(
  state: GameState,
  frame: Frame,
  step: DiscardStep,
  events: GameEvent[],
  player: Side | undefined,
): "ran" | "paused" | EngineError {
  const owner = step.side;
  const picker = step.chosenBy === "player" ? player : owner;
  if (picker === undefined)
    return invalidProgram("A discard picked by the player needs the side that played the card.");
  const hand = state.private[owner].hand;
  if (step.chosenBy === undefined || hand.length <= step.count) {
    discardFromHand(state, owner, step.count, events);
    frame.next += 1;
    return "ran";
  }
  if (picker !== owner) revealHand(state, owner, events);
  const from = picker === owner ? "hand" : "rivalHand";
  state.public.pending = [newDiscardDecision(state.meta.seq, picker, from, step.count)];
  return "paused";
}

/**
 * Resumes the top frame, paused at a discardFromHand step with `chosenBy`, with the picked `cards` (apply has
 * checked them against legalAnswers): they leave the hand for the discard pile, and the frame moves on. Any
 * other top frame, or a card not in the hand, is a broken program.
 */
export function resumeDiscard(state: GameState, cards: readonly CardId[], events: GameEvent[]): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  if (!frame || step?.op !== "discardFromHand" || step.chosenBy === undefined) {
    return invalidProgram("The stack is not paused at a discard someone picks.");
  }
  const hand = state.private[step.side].hand;
  if (cards.some((card) => !hand.includes(card))) return invalidProgram("A picked card is not in the hand.");
  discardChosen(state, step.side, cards, events);
  frame.next += 1;
  state.public.pending = [];
  return null;
}
