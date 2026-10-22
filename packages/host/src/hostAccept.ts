// The shared second half of every host call that moves a game: run the answer through the engine,
// then build the new record, secret, frames and effects. hostSubmit and hostTimeout both end here.
import { apply, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Answer, GameState, Ruleset, Side } from "@terminal-dusk/engine";
import { copyJson, framesFor } from "./frames.ts";
import { checkFinished } from "./hostFinish.ts";
import type { HostEffect, HostError, HostOutcome, MatchRecord, MatchSecret } from "./types.ts";

/**
 * Applies `answer`, already checked by the caller, at time `now`. An engine refusal passes through with
 * the engine's code. A finished game is checked again from its move log and its seed is published.
 */
export function acceptAnswer(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  answer: Answer,
  now: number,
): HostOutcome {
  const result = apply(ruleset, secret.state, answer);
  if (!result.ok) return { ok: false, error: result.error };
  const { state, events } = result.value;
  const log = [...copyJson(secret.log), answer];
  const over = state.public.status.kind === "over";
  if (over) {
    const failed = checkFinished(ruleset, secret, log, state);
    if (failed) return { ok: false, error: failed };
  }
  const effects: HostEffect[] = SIDES.filter((s) => newDecision(secret.state, state, s)).map((s) => ({
    notify: record.players[s],
  }));
  if (over) effects.push({ finalize: true });
  return {
    ok: true,
    value: {
      record: {
        ...record,
        players: { ...record.players },
        seq: state.meta.seq,
        status: copyJson(state.public.status),
        updatedAt: now,
        ...(over ? { seed: secret.seed } : {}),
      },
      secret: { seed: secret.seed, setup: copyJson(secret.setup), state, log },
      frames: framesFor(record.matchId, state, events),
      effects,
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
