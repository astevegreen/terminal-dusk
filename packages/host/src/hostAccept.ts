// The shared second half of every host call that moves a game: run the answer through the engine,
// then build the new record, secret, frames and effects. hostSubmit and hostTimeout both end here.
import { apply, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Answer, GameEvent, GameState, Ruleset, Side } from "@terminal-dusk/engine";
import { deadlineEffects, nextClock } from "./clock.ts";
import { copyJson, framesFor } from "./frames.ts";
import { checkFinished } from "./hostFinish.ts";
import type { HostEffect, HostError, HostOutcome, MatchRecord, MatchSecret } from "./types.ts";

/**
 * Applies `answer`, already checked by the caller, at time `now`. An engine refusal passes through with
 * the engine's code. A finished game is checked again from its move log and its seed is published.
 * A match with a clock gets its next clock; `usedGrace` names a side whose late answer used its extension.
 */
export function acceptAnswer(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  answer: Answer,
  now: number,
  usedGrace: Side | null = null,
): HostOutcome {
  const result = apply(ruleset, secret.state, answer);
  if (!result.ok) return { ok: false, error: result.error };
  const { state, events } = result.value;
  return commitSteps(
    ruleset,
    record,
    secret,
    { state, events, log: [...copyJson(secret.log), answer] },
    now,
    usedGrace,
  );
}

/** Where one or more accepted answers led: the new state, every event they produced in order, and the whole log. */
export type Steps = { state: GameState; events: GameEvent[]; log: Answer[] };

/**
 * Builds the new record, secret, frames and effects from `steps`, already applied from `secret.state` at `now`.
 * acceptAnswer ends here with one answer; the stand-in (hostStandIn.ts) with several.
 */
export function commitSteps(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  steps: Steps,
  now: number,
  usedGrace: Side | null = null,
): HostOutcome {
  const { state, events, log } = steps;
  const over = state.public.status.kind === "over";
  if (over) {
    const failed = checkFinished(ruleset, secret, log, state);
    if (failed) return { ok: false, error: failed };
  }
  const effects: HostEffect[] = SIDES.filter((s) => newDecision(secret.state, state, s)).map((s) => ({
    notify: record.players[s],
  }));
  if (over) effects.push({ finalize: true });
  const next: MatchRecord = {
    ...record,
    players: { ...record.players },
    seq: state.meta.seq,
    status: copyJson(state.public.status),
    updatedAt: now,
    ...(over ? { seed: secret.seed } : {}),
    ...(record.clock ? { clock: nextClock(record.clock, secret.state, state, now, usedGrace) } : {}),
  };
  return {
    ok: true,
    value: {
      record: next,
      secret: { seed: secret.seed, setup: copyJson(secret.setup), state, log },
      frames: framesFor(record.matchId, state, events),
      effects: [...effects, ...deadlineEffects(next)],
    },
  };
}

/** Refuses `now` unless it is a whole number no earlier than the record's last update; else null. */
export function badTime(record: MatchRecord, now: number): HostError | null {
  return !Number.isInteger(now) || now < record.updatedAt
    ? { code: "invalidTime", message: "The time must be a whole number, not earlier than the last update." }
    : null;
}

/** True when `side` now has a waiting decision whose id it did not have before this answer. */
function newDecision(before: GameState, after: GameState, side: Side): boolean {
  const now = pendingFor(after, side);
  return now !== null && pendingFor(before, side)?.id !== now.id;
}
