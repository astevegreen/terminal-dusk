// The fuzz check for the sides' special abilities (#602, packages/engine/src/abilities.ts): checkStep (checks.ts) runs
// it on every state. The state's `abilities` must match the setup, stay in bounds, and agree with the step's events.
import { SIDES } from "@terminal-dusk/engine";
import type { AbilityState, GameEvent, GameState, Setup, Side, SideAbility } from "@terminal-dusk/engine";

const count = (events: readonly GameEvent[], kind: GameEvent["kind"], side: Side): number =>
  events.filter((event) => event.kind === kind && "side" in event && event.side === side).length;

/**
 * A game whose setup names no abilities never has `abilities`. Otherwise each side's ability is the setup's, with
 * the setup's number, and its use this turn is a whole number in bounds: Resilient institutions at most `perTurn`;
 * Unified command at most once, and never ready once used. Each of the step's ability events belongs to a side
 * that has that ability, with the setup's numbers: a redraw sets a 1 aside from the side's own deck, a bonus adds
 * the side's `bonus`. One step never redraws more than `perTurn` times, nor pays a bonus twice, for one side.
 */
export function checkAbilities(setup: Setup, state: GameState, events: readonly GameEvent[]): void {
  const abilities = state.public.abilities;
  if (setup.abilities === undefined) {
    if (abilities !== undefined) throw new Error("the setup names no abilities, but the state has `abilities`");
    return;
  }
  if (abilities === undefined) throw new Error("the setup names abilities, but the state has no `abilities`");
  for (const side of SIDES) checkSide(side, setup.abilities[side], abilities[side], events);
  for (const event of events) checkEvent(setup.abilities, event);
}

/** One side's ability against the setup's, and the step's events for that side. */
function checkSide(side: Side, named: SideAbility, ability: AbilityState, events: readonly GameEvent[]): void {
  const { used } = ability;
  if (ability.id !== named.id) throw new Error(`${side}'s ability is ${ability.id}, but the setup names ${named.id}`);
  if (!Number.isInteger(used) || used < 0) throw new Error(`${side}'s ability was used ${String(used)} times`);
  const redraws = count(events, "abilityRedraw", side);
  const bonuses = count(events, "abilityBonus", side);
  if (ability.id === "resilientInstitutions" && named.id === "resilientInstitutions") {
    checkResilient(side, named.perTurn, ability.perTurn, used, redraws);
    const commandEvents = count(events, "abilityReady", side) + bonuses;
    if (commandEvents > 0) throw new Error(`${side} has Resilient institutions but got a Unified command event`);
  } else if (ability.id === "unifiedCommand" && named.id === "unifiedCommand") {
    if (ability.bonus !== named.bonus) throw new Error(`${side}'s bonus is ${ability.bonus}, not ${named.bonus}`);
    checkCommand(side, ability.ready, used, bonuses);
    if (redraws > 0) throw new Error(`${side} has Unified command but got a redraw`);
  }
}

function checkResilient(side: Side, setupPerTurn: number, perTurn: number, used: number, redraws: number): void {
  if (perTurn !== setupPerTurn) throw new Error(`${side}'s perTurn is ${perTurn}, not ${setupPerTurn}`);
  if (used > perTurn) throw new Error(`${side}'s Resilient institutions was used ${used} times, over ${perTurn}`);
  if (redraws > perTurn) throw new Error(`one step redrew ${redraws} times for ${side}, over ${perTurn}`);
}

function checkCommand(side: Side, ready: boolean, used: number, bonuses: number): void {
  if (used > 1) throw new Error(`${side}'s Unified command was used ${used} times in a turn`);
  if (ready && used > 0) throw new Error(`${side}'s Unified command is ready again after it was used`);
  if (bonuses > 1) throw new Error(`one step paid ${side}'s Unified command ${bonuses} times`);
}

/** A redraw sets a 1 aside from the side's own deck; a bonus adds the side's `bonus`. */
function checkEvent(named: Record<Side, SideAbility>, event: GameEvent): void {
  if (event.kind === "abilityRedraw" && (event.deck !== event.side || event.setAside !== 1)) {
    throw new Error(`a redraw set aside ${event.setAside} from ${event.deck} for ${event.side}`);
  }
  if (event.kind === "abilityBonus") {
    const ability = named[event.side];
    if (ability.id !== "unifiedCommand" || event.amount !== ability.bonus) {
      throw new Error(`${event.side}'s Unified command added ${event.amount}, not its bonus`);
    }
  }
}

/**
 * One answer's step, from `prior` to `state`: in the same turn, each side's use grows by exactly its step's redraws
 * and bonuses. When the turn moved on, the use is reset first, so it is at most the step's own; with no ability
 * event in the step it is 0, and Unified command is not ready (a bonus not used is lost at turn end).
 */
export function checkAbilityStep(prior: GameState, events: readonly GameEvent[], state: GameState): void {
  const before = prior.public.abilities;
  const after = state.public.abilities;
  if (before === undefined || after === undefined) return;
  const sameTurn = prior.public.turn === state.public.turn;
  for (const side of SIDES) {
    const uses = count(events, "abilityRedraw", side) + count(events, "abilityBonus", side);
    const was = before[side].used;
    const now = after[side];
    if (sameTurn && now.used !== was + uses) {
      throw new Error(`${side}'s ability went from ${was} to ${now.used} uses, but the step used it ${uses} times`);
    }
    if (!sameTurn && now.used > uses) {
      throw new Error(`a new turn began, but ${side}'s ability shows ${now.used} uses after ${uses} in the step`);
    }
    if (
      !sameTurn &&
      uses === 0 &&
      count(events, "abilityReady", side) === 0 &&
      now.id === "unifiedCommand" &&
      now.ready
    ) {
      throw new Error(`a new turn began, but ${side}'s Unified command is still ready`);
    }
  }
}
