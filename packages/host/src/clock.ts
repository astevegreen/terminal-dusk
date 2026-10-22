// A match's clock: who must answer by when, and who has had their grace extension (architecture
// Decision 5, "Deadlines"). Each side's clock starts when the game waits on it and restarts after it answers.
import { pendingFor, SIDES } from "@terminal-dusk/engine";
import type { GameState, Side } from "@terminal-dusk/engine";
import type { HostEffect, MatchClock, MatchDeadline, MatchRecord } from "./types.ts";

const DAY_MS = 86_400_000;
const RULES: readonly unknown[] = ["lossOnTime", "graceThenLoss"];
const DAYS: readonly unknown[] = [1, 3, 7];

/** True when `deadline` is a usable deadline setting: a known rule and 1, 3 or 7 days. */
export function validDeadline(deadline: unknown): deadline is MatchDeadline {
  if (typeof deadline !== "object" || deadline === null) return false;
  const d = deadline as Partial<MatchDeadline>;
  return RULES.includes(d.rule) && DAYS.includes(d.days);
}

/** One deadline length: the match's days in milliseconds. */
export const lengthOf = (clock: MatchDeadline): number => clock.days * DAY_MS;

/** The clock at the start: each side with a waiting decision gets one length from `now`; no grace used. */
export function startClock(deadline: MatchDeadline, state: GameState, now: number): MatchClock {
  const at = (side: Side): number | null => (pendingFor(state, side) === null ? null : now + lengthOf(deadline));
  return {
    rule: deadline.rule,
    days: deadline.days,
    deadlines: { lio: at("lio"), sae: at("sae") },
    graceUsed: { lio: false, sae: false },
  };
}

/**
 * The clock after an accepted move from `before` to `after` at `now`. A side with no waiting decision
 * gets null; a new decision (a different id, or none before) restarts its clock; the same one keeps its
 * deadline. `usedGrace` marks a side whose late answer used its extension.
 */
export function nextClock(
  clock: MatchClock,
  before: GameState,
  after: GameState,
  now: number,
  usedGrace: Side | null,
): MatchClock {
  const at = (side: Side): number | null => {
    const waiting = pendingFor(after, side);
    if (waiting === null) return null;
    return pendingFor(before, side)?.id === waiting.id ? clock.deadlines[side] : now + lengthOf(clock);
  };
  return {
    rule: clock.rule,
    days: clock.days,
    deadlines: { lio: at("lio"), sae: at("sae") },
    graceUsed: { lio: clock.graceUsed.lio || usedGrace === "lio", sae: clock.graceUsed.sae || usedGrace === "sae" },
  };
}

/** One `{ deadlineAt }` effect with the earliest deadline, while the game is active and has one; else none. */
export function deadlineEffects(record: MatchRecord): HostEffect[] {
  if (record.status.kind !== "active" || !record.clock) return [];
  const times = SIDES.map((s) => record.clock?.deadlines[s]).filter((t): t is number => typeof t === "number");
  return times.length === 0 ? [] : [{ deadlineAt: Math.min(...times) }];
}

/** True when `side` has a deadline and it is at or before `now`. */
export function isLate(clock: MatchClock, side: Side, now: number): boolean {
  const deadline = clock.deadlines[side];
  return deadline !== null && deadline <= now;
}

/** True when `side` may still use a grace extension under this clock's rule. */
export const hasGrace = (clock: MatchClock, side: Side): boolean =>
  clock.rule === "graceThenLoss" && !clock.graceUsed[side];

/** True when `clock` has the shape the host writes, so reading it can never throw. */
export function validClock(clock: unknown): clock is MatchClock {
  if (!validDeadline(clock)) return false;
  const c = clock as Partial<MatchClock>;
  if (typeof c.deadlines !== "object" || c.deadlines === null) return false;
  if (typeof c.graceUsed !== "object" || c.graceUsed === null) return false;
  const { deadlines, graceUsed } = c;
  return SIDES.every(
    (s) => (deadlines[s] === null || Number.isInteger(deadlines[s])) && typeof graceUsed[s] === "boolean",
  );
}
