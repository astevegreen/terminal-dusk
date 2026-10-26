// The Escalation track's types (docs/design/map-and-points.md, "Escalation"): one shared public number from 0 to 6.
// types.ts re-exports them, so index.ts exports the same names.
import type { Side } from "./types.ts";

/** Escalation moved from `from` to `to`: one event for each change of value. */
export type EscalationChanged = { kind: "escalationChanged"; visibility: "public"; from: number; to: number };
/**
 * Escalation reached 6: `side`, the side that caused it, drew `value` from its own Contingency deck, and
 * Escalation drops to 3 (the escalationChanged event after this one).
 */
export type EscalationCrisis = { kind: "escalationCrisis"; visibility: "public"; side: Side; value: number };
/** Every Escalation event: both are public. */
export type EscalationEvent = EscalationChanged | EscalationCrisis;
