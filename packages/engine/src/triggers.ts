// Triggers (docs/architecture.md, section 4): reactions a card leaves behind, kept in public state and run
// only at fixed hook points. The hooks so far are a card being played and the turn's end; the one duration
// lasts until the end of the turn the trigger was set in.
//
// Firing a hook pushes one program per waiting trigger onto the resolution stack at once, the first set on
// top, so each finishes before the next starts. A decision inside a reaction pauses the stack as any other
// does. A trigger set while they run was not pushed, so it waits for the hook's next time. A reaction can
// neither play a card nor end a turn, so a trigger can never make its own hook happen again.
import { copyJson } from "./copy.ts";
import type { ActiveTrigger, Binding, CardId, Frame, GameEvent, GameState, Step } from "./types.ts";

type TriggerStep = Extract<Step, { op: "trigger" }>;

/**
 * Runs a `trigger` step for the card `source`: the trigger joins the end of the list, to end with the
 * current turn, and everyone is told. Edits `state`, a working copy.
 */
export function setTrigger(state: GameState, source: CardId, step: TriggerStep, events: GameEvent[]): void {
  const expires = { kind: step.duration.kind, turn: state.public.turn };
  state.public.triggers.push({ source, hook: step.hook, do: copyJson(step.do), expires });
  events.push({ kind: "triggerSet", visibility: "public", source, hook: step.hook });
}

/**
 * Called as each program leaves the stack. When it is the program of the card a side is playing (its
 * event, its points, or a rival card's both, in the chosen order), the card has fully resolved: every
 * cardPlayed trigger but the card's own fires, with `card` and `player` bound. The card is still in
 * `inPlay`; it goes to the discard pile once they finish. Opening cards (no play made yet) never fire it.
 */
export function afterProgram(state: GameState, finished: Frame, events: GameEvent[]): void {
  const pub = state.public;
  const played = pub.inPlay[0];
  const isPlay = finished.kind === "program" && pub.playsMade > 0 && pub.inPlay.length === 1;
  if (!isPlay || finished.source !== played || played === undefined) return;
  // LIO makes the plays with an even count before them, so the play just counted tells who made it.
  const player = (pub.playsMade - 1) % 2 === 0 ? "lio" : "sae";
  const reacting = pub.triggers.filter((t) => t.hook === "cardPlayed" && t.source !== played);
  pushReactions(
    state,
    reacting,
    [
      { name: "card", value: played },
      { name: "player", value: player },
    ],
    events,
  );
}

/**
 * The turn's last play has finished: every turnEnd trigger leaves the list and fires, with `turn` bound.
 * Firing is how a turnEnd trigger ends. `turnEndFired` keeps the hook from firing twice while they run.
 */
export function fireTurnEnd(state: GameState, events: GameEvent[]): void {
  const pub = state.public;
  pub.turnEndFired = true;
  const firing = pub.triggers.filter((t) => t.hook === "turnEnd");
  pub.triggers = pub.triggers.filter((t) => t.hook !== "turnEnd");
  pushReactions(state, firing, [{ name: "turn", value: pub.turn }], events);
}

/** Tells everyone each trigger fired, in set order, and pushes their programs with the first set on top. */
function pushReactions(state: GameState, triggers: ActiveTrigger[], vars: Binding[], events: GameEvent[]): void {
  for (const { source, hook } of triggers) events.push({ kind: "triggerFired", visibility: "public", source, hook });
  for (const trigger of [...triggers].reverse()) {
    const steps = copyJson(trigger.do);
    state.public.stack.push({ kind: "program", steps, next: 0, vars: copyJson(vars), source: trigger.source });
  }
}

/**
 * The current turn is ending: each trigger still waiting, set to last until then, is removed in the order
 * they were set, and each emits triggerEnded. Edits `state`, a working copy.
 */
export function endTurnTriggers(state: GameState, events: GameEvent[]): void {
  const turn = state.public.turn;
  const ending = state.public.triggers.filter((t) => t.expires.kind === "turnEnd" && t.expires.turn === turn);
  state.public.triggers = state.public.triggers.filter((t) => !ending.includes(t));
  for (const { source, hook } of ending) events.push({ kind: "triggerEnded", visibility: "public", source, hook });
}

/** Why a trigger step's values are unusable, or null: a hook and duration the engine knows, and a reaction. */
export function badTrigger(step: TriggerStep): string | null {
  if (step.hook !== "cardPlayed" && step.hook !== "turnEnd")
    return "sets a trigger for a hook the engine doesn't have.";
  if (!Array.isArray(step.do) || step.do.length === 0) return "sets a trigger with no steps to run.";
  if (step.duration?.kind !== "turnEnd") return "sets a trigger with a duration the engine doesn't have.";
  return null;
}
