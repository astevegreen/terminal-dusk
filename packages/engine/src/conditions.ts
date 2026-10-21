// An `if` step's condition (stack.ts): a yes/no answer, a number test, `has` a lasting marker, or
// `playedBy` the side that picked or played the card.
import { hasMarker } from "./markers.ts";
import type { Condition, EngineError, GameState, Side, VarName, VarValue } from "./types.ts";

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

export const unbound = (name: VarName): EngineError => invalidProgram(`No variable "${name}" is bound here.`);
export const notANumber = (name: VarName, user: string): EngineError =>
  invalidProgram(`"${name}" does not hold a number, so ${user} cannot use it.`);

/**
 * Whether `cond` holds now. `has` reads the lasting markers set so far; `playedBy` reads `player`, the side
 * the running program records as having picked or played its card (none recorded is an error). The other
 * conditions read the variable they name, through `lookup`, and an unbound or ill-fitting variable is an error.
 */
export function testCondition(
  state: GameState,
  cond: Condition,
  lookup: (name: VarName) => VarValue | undefined,
  player: Side | undefined,
): boolean | EngineError {
  if (cond.op === "has") return hasMarker(state, cond.marker);
  if (cond.op === "playedBy") return readPlayedBy(cond, player);
  const value = lookup(cond.var);
  if (value === undefined) return unbound(cond.var);
  return cond.op === "yes" ? readYes(value, cond) : readNumberTest(value, cond);
}

/** Whether the side that picked or played the card is the one `cond` names; an error when none is recorded. */
function readPlayedBy(cond: Extract<Condition, { op: "playedBy" }>, player: Side | undefined): boolean | EngineError {
  if (player === undefined) {
    return invalidProgram("An if on playedBy needs the side that played the card, and this program has none.");
  }
  return player === cond.side;
}

/** The result of an atLeast, atMost or equals test on a number. */
function readNumberTest(
  value: VarValue,
  cond: Extract<Condition, { op: "atLeast" | "atMost" | "equals" }>,
): boolean | EngineError {
  if (typeof value !== "number") return notANumber(cond.var, cond.op);
  if (cond.op === "atLeast") return value >= cond.value;
  if (cond.op === "atMost") return value <= cond.value;
  return value === cond.value;
}

/**
 * The yes/no a condition tests: a one-side answer as it is, or the named side's half of a both-sides
 * answer. A condition naming a side for a one-side answer, or none for a both-sides one, is an error.
 */
function readYes(value: VarValue, cond: Extract<Condition, { op: "yes" }>): boolean | EngineError {
  const notYesNo = invalidProgram(`"${cond.var}" is not a yes/no answer, so if cannot test it.`);
  if (typeof value === "boolean") {
    return cond.side === undefined
      ? value
      : invalidProgram(`"${cond.var}" holds one answer; the if must not name a side.`);
  }
  if (typeof value !== "object") return notYesNo;
  if (typeof value.lio !== "boolean" || typeof value.sae !== "boolean") return notYesNo;
  return cond.side === undefined
    ? invalidProgram(`"${cond.var}" holds both sides' answers; the if must name a side.`)
    : value[cond.side];
}
