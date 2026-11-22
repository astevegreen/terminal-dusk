// The sides' special abilities (docs/design/sides.md, "Asymmetry"): what a setup names, what the game keeps track of
// each turn, and the events they give. types.ts re-exports them. The numbers are the scenario's, never code's.
import type { DeckId } from "./contingencyTypes.ts";
import type { Side } from "./types.ts";

/**
 * A side's ability, as the setup names it. `resilientInstitutions`: up to `perTurn` times a turn, a draw from the
 * side's own Contingency deck that shows a 1 is set aside and drawn again (never the crisis draw). `unifiedCommand`:
 * after the side plays its own card for its event, the next card it plays for its points counts `bonus` more.
 */
export type SideAbility = { id: "resilientInstitutions"; perTurn: number } | { id: "unifiedCommand"; bonus: number };
export type AbilityId = SideAbility["id"];

/**
 * A side's ability during the game: the setup's numbers, plus `used`, how often it worked this turn, and for
 * Unified command `ready`, true once an event has set up the next play for points. Both reset at turn end.
 */
export type AbilityState =
  | { id: "resilientInstitutions"; perTurn: number; used: number }
  | { id: "unifiedCommand"; bonus: number; ready: boolean; used: number };

/** `side`'s ability set a drawn 1 (`setAside`) aside from `deck`; the next contingencyDrawn is its redraw. */
export type AbilityRedraw = { kind: "abilityRedraw"; visibility: "public"; side: Side; deck: DeckId; setAside: number };
/** `side`'s ability is ready: its next card played for points this turn counts more. */
export type AbilityReady = { kind: "abilityReady"; visibility: "public"; side: Side };
/** `side`'s ability added `amount` to the points of the card it is playing for them. */
export type AbilityBonus = { kind: "abilityBonus"; visibility: "public"; side: Side; amount: number };
export type AbilityEvent = AbilityRedraw | AbilityReady | AbilityBonus;
