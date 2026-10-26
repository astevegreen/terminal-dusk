// The types of what a card leaves in force: hooks, durations, modifiers and triggers (modifiers.ts,
// triggers.ts). types.ts re-exports them, so index.ts exports the same names.
import type { CardId, Condition, Side, Step } from "./types.ts";

/**
 * The named moments a trigger can react to. `cardPlayed`: a side's play has fully resolved, before the
 * card goes to the discard pile (never an opening card). `turnEnd`: the turn's last play has finished.
 */
export type HookId = "cardPlayed" | "turnEnd";

/** How long a modifier lasts. `turnEnd`: until the end of the turn in which it was made. */
export type Duration = { kind: "turnEnd" };
/**
 * A rule change (docs/architecture.md, section 4, "Modifiers"), consulted only at its hook. `opsValue`:
 * for cards whose action points `side` (or either side, for "both") spends, the ops value is `add` more
 * (negative: less), then never below `min` when given. `add` is a non-zero whole number, `min` a whole
 * number, 0 or more. How several combine, and the floor of 0, are in modifiers.ts.
 */
export type ModifierSpec = { hook: "opsValue"; side: Side | "both"; add: number; min?: number };
/** When a modifier in force ends: at the end of turn `turn`, the turn it was made in. */
export type ModifierExpiry = { kind: "turnEnd"; turn: number };
/** A `modifier` step ran: `source`'s effect made the rule change `mod`, in force until `expires`. */
export type ModifierStarted = {
  kind: "modifierStarted";
  visibility: "public";
  source: CardId;
  mod: ModifierSpec;
  expires: ModifierExpiry;
};
/** A modifier's duration ran out (the turn it was made in ended), so its rule change no longer applies. */
export type ModifierEnded = { kind: "modifierEnded"; visibility: "public"; source: CardId; mod: ModifierSpec };
/** A modifier in force: the card whose effect made it, the rule change, and when it ends. */
export type ActiveModifier = { source: CardId; mod: ModifierSpec; expires: ModifierExpiry };
/**
 * What a trigger's `filter` may test when its hook happens: `has` a lasting marker, or (cardPlayed only)
 * `playedBy`, the side that made the play that fired the hook. It reads no variable (triggers.ts).
 */
export type TriggerFilter = Extract<Condition, { op: "playedBy" | "has" }>;
/**
 * A trigger waiting for its hook: the card that set it, the hook, its reaction, and when it ends (as a modifier).
 * `player` and `worldFor`, when its program had them, go with its reaction (Frame, in types.ts). `filter`
 * and `once`, when its step had them, are copied from it.
 */
export type ActiveTrigger = {
  source: CardId;
  hook: HookId;
  filter?: TriggerFilter;
  once?: true;
  do: Step[];
  expires: ModifierExpiry;
  player?: Side;
  worldFor?: Side;
};
