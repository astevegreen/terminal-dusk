// TEST-ONLY FIXTURES, never game content: the trigger `filter` and `once` (R7a) the reaction cards use
// (reactions.ts). Each such trigger's reaction is one plain marker naming its variant, so it asks nothing and
// no decision id changes. The fuzz check for them is in filterChecks.ts.
import type { Side, Step, TriggerFilter } from "@terminal-dusk/engine";
import { LASTING_LABELS } from "./markers.ts";

/** Starts the label of the marker each filtered or once trigger's reaction emits; then its variant. */
export const FILTERED = "filtered:";

/**
 * The kinds of filtered or once trigger: cardPlayed filtered on playedBy LIO or SAE, on `has` a lasting marker
 * (cardPlayed and turnEnd), cardPlayed with `once`, and cardPlayed with a playedBy filter and `once`.
 */
export const VARIANTS = [
  "playedByLio",
  "playedBySae",
  "hasOnCardPlayed",
  "hasOnTurnEnd",
  "once",
  "filterAndOnce",
] as const;
export type Variant = (typeof VARIANTS)[number];

/**
 * Card `i` gets the variant its index picks modulo this many; the last remainder gets none. 7 is coprime to 3,
 * and affiliations go LIO, SAE, neutral, so within c1 to c21 every variant is on a card of each affiliation.
 */
const PERIOD = 7;

/** The variant of card `i`'s filtered or once trigger, or null for none. */
export const variantOf = (i: number): Variant | null => VARIANTS[i % PERIOD] ?? null;

/**
 * Card `i`'s filtered or once trigger, or none. `k` counts the cards of the same variant, so the `has` label
 * and the side of the filter-and-once trigger take turns.
 */
export function filteredTriggerOf(i: number): Step[] {
  const variant = variantOf(i);
  if (variant === null) return [];
  const k = Math.floor(i / PERIOD);
  const has: TriggerFilter = { op: "has", marker: LASTING_LABELS[k % LASTING_LABELS.length]! };
  const side: Side = k % 2 === 0 ? "lio" : "sae";
  const hook = variant === "hasOnTurnEnd" ? "turnEnd" : "cardPlayed";
  const shown: Step = { op: "marker", label: `${FILTERED}${variant}`, var: hook === "turnEnd" ? "turn" : "card" };
  const step: Extract<Step, { op: "trigger" }> = { op: "trigger", hook, do: [shown], duration: { kind: "turnEnd" } };
  switch (variant) {
    case "playedByLio":
      return [{ ...step, filter: { op: "playedBy", side: "lio" } }];
    case "playedBySae":
      return [{ ...step, filter: { op: "playedBy", side: "sae" } }];
    case "hasOnCardPlayed":
    case "hasOnTurnEnd":
      return [{ ...step, filter: has }];
    case "once":
      return [{ ...step, once: true }];
    case "filterAndOnce":
      return [{ ...step, filter: { op: "playedBy", side }, once: true }];
  }
}
