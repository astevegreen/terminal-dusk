// Modifiers (docs/architecture.md, section 4): rule changes with a duration, kept in public state and
// consulted only at fixed hook points. The one hook so far is a card's ops value; the one duration lasts
// until the end of the turn the modifier was made in.
import { copyJson } from "./copy.ts";
import type { CardDef, CardId, GameEvent, GameState, ModifierSpec, Side, Step } from "./types.ts";

/**
 * A card's ops when `side` spends its action points, as changed by every opsValue modifier in force for
 * that side or for both. They apply in the order they were made, each adding its `add` to the running value
 * and then raising it to its own `min`, if it has one (owner's decision, 18 Oct). The result is never below
 * 0, as points are a count. Worked out when the points are spent, so an event that ran just before counts.
 */
export function opsValue(state: GameState, card: Pick<CardDef, "ops">, side: Side): number {
  let value = card.ops;
  for (const { mod } of state.public.modifiers) {
    if (mod.hook !== "opsValue" || (mod.side !== side && mod.side !== "both")) continue;
    value += mod.add;
    if (mod.min !== undefined) value = Math.max(value, mod.min);
  }
  return Math.max(value, 0);
}

/**
 * Runs a `modifier` step for the card `source`: the modifier joins the end of the list, to end with the
 * current turn, and everyone is told. Edits `state`, a working copy.
 */
export function startModifier(
  state: GameState,
  source: CardId,
  step: Extract<Step, { op: "modifier" }>,
  events: GameEvent[],
): void {
  const expires = { kind: step.duration.kind, turn: state.public.turn };
  state.public.modifiers.push({ source, mod: copyJson(step.mod), expires });
  events.push({
    kind: "modifierStarted",
    visibility: "public",
    source,
    mod: copyJson(step.mod),
    expires: { ...expires },
  });
}

/**
 * The current turn is ending: each modifier made to last until then is removed, in the order they were
 * made, and each emits modifierEnded. Edits `state`, a working copy.
 */
export function endTurnModifiers(state: GameState, events: GameEvent[]): void {
  const turn = state.public.turn;
  const ending = state.public.modifiers.filter((m) => m.expires.kind === "turnEnd" && m.expires.turn === turn);
  state.public.modifiers = state.public.modifiers.filter((m) => !ending.includes(m));
  for (const { source, mod } of ending) events.push({ kind: "modifierEnded", visibility: "public", source, mod });
}

/** Why a modifier's values are unusable, or null: the hook, side, add, min and duration the engine knows. */
export function badModifier(mod: ModifierSpec, duration: { kind: string }): string | null {
  if (mod?.hook !== "opsValue") return "makes a modifier for a hook the engine doesn't have.";
  if (mod.side !== "lio" && mod.side !== "sae" && mod.side !== "both") {
    return "makes a modifier for a side that is not lio, sae or both.";
  }
  if (!Number.isInteger(mod.add) || mod.add === 0) return "makes a modifier whose add is not a non-zero whole number.";
  if (mod.min !== undefined && (!Number.isInteger(mod.min) || mod.min < 0)) {
    return "makes a modifier whose min is not a whole number, 0 or more.";
  }
  if (duration?.kind !== "turnEnd") return "makes a modifier with a duration the engine doesn't have.";
  return null;
}
