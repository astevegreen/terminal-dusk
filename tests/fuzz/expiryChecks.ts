// The fuzz checks that modifiers and triggers end with their turn (#89, #90). Moved out of checks.ts unchanged,
// so that file stays under the size limit; checkStep (checks.ts) runs them on every state.
import type { GameState, ModifierExpiry } from "@terminal-dusk/engine";

/**
 * Modifiers end with the turn they were made in (#89): while the game is active, every modifier in force
 * expires at the end of the current turn; once it is over, none is left. Runs on finished games too.
 */
export function checkModifiers(state: GameState): void {
  checkEndsThisTurn(state, "modifiers", state.public.modifiers);
}

/**
 * Triggers end with the turn they were set in (#90), as modifiers do; and while a play is open, this turn's
 * turnEnd hook has not fired yet. Runs on finished games too.
 */
export function checkTriggers(state: GameState): void {
  checkEndsThisTurn(state, "triggers", state.public.triggers);
  const { pending, turnEndFired } = state.public;
  if (turnEndFired && pending.some((d) => d.kind === "playCardAs")) {
    throw new Error("a play is open, but this turn's turnEnd hook has already fired");
  }
}

/** While the game is active, each of `items` (`what`) ends with the current turn; once it is over, none is left. */
function checkEndsThisTurn(state: GameState, what: string, items: readonly { expires: ModifierExpiry }[]): void {
  const { status, turn } = state.public;
  if (status.kind === "over") {
    if (items.length > 0) throw new Error(`the game is over, but ${items.length} ${what} are still in force`);
    return;
  }
  const stale = items.filter((m) => m.expires.kind !== "turnEnd" || m.expires.turn !== turn);
  if (stale.length > 0) {
    throw new Error(`in turn ${turn}, ${what} that do not end with this turn are in force: ${JSON.stringify(stale)}`);
  }
}
