// The escalate step (R18a; docs/design/map-and-points.md, "Escalation"): a card's event moves Escalation by `by`.
// A raise is caused by the player who picked or played the card, even the rival's card, so a crisis it makes draws
// from that side's own deck. A lower has no cause. In a game without a map both change nothing (escalation.ts).
import { lowerEscalation, raiseEscalation } from "./escalation.ts";
import type { EngineError, GameEvent, GameState, Side, Step } from "./types.ts";

type EscalateStep = Extract<Step, { op: "escalate" }>;

/**
 * Runs an escalate step for the program whose player is `player` (read from the program's frame, so a step inside
 * an if, a forEach or a trigger's reaction names the card's player). A raise with no player is invalidProgram, in a
 * game with a map or without. Edits `state`, apply's working copy, in place.
 */
export function runEscalate(
  state: GameState,
  step: EscalateStep,
  player: Side | undefined,
  events: GameEvent[],
): EngineError | null {
  if (step.by < 0) {
    lowerEscalation(state, -step.by, events);
    return null;
  }
  if (player === undefined) {
    return { code: "invalidProgram", message: "A raise of Escalation needs the side that played the card." };
  }
  raiseEscalation(state, step.by, player, events);
  return null;
}
