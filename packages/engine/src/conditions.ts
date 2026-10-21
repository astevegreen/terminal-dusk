// An `if` step's condition (stack.ts): a yes/no answer, a number test, or `has` a lasting marker.
import { hasMarker } from "./markers.ts";
import type { Condition, EngineError, GameState, VarName, VarValue } from "./types.ts";

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

export const unbound = (name: VarName): EngineError => invalidProgram(`No variable "${name}" is bound here.`);
export const notANumber = (name: VarName, user: string): EngineError =>
  invalidProgram(`"${name}" does not hold a number, so ${user} cannot use it.`);

/**
 * Whether `cond` holds now. `has` reads the lasting markers set so far; the other conditions read the
 * variable they name, through `lookup`, and an unbound or ill-fitting variable is an error.
 */
export function testCondition(
  state: GameState,
  cond: Condition,
  lookup: (name: VarName) => VarValue | undefined,
): boolean | EngineError {
  if (cond.op === "has") return hasMarker(state, cond.marker);
  const value = lookup(cond.var);
  if (value === undefined) return unbound(cond.var);
  return cond.op === "yes" ? readYes(value, cond) : readNumberTest(value, cond);
}

/** The result of an atLeast, atMost or equals test on a number. */
function readNumberTest(value: VarValue, cond: Exclude<Condition, { op: "yes" | "has" }>): boolean | EngineError {
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
