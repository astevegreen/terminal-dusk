// Taking an answer: the host's own checks, then the engine, then the new record, secret, frames and effects.
import { apply, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Answer, GameState, Ruleset, Side } from "@terminal-dusk/engine";
import { copyJson, framesFor } from "./frames.ts";
import type { HostEffect, HostError, HostOutcome, MatchRecord, MatchSecret, Submission } from "./types.ts";

/**
 * Takes one player's answer or resignation. The host checks, in order: notPlayer, invalidTime, staleSeq;
 * only then does the engine see the answer (so a game-ending move sent twice gives staleSeq, not gameOver).
 * A refusal returns an error and changes nothing. It never throws, and never changes its inputs.
 */
export function hostSubmit(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  submission: Submission,
  now: number,
): HostOutcome {
  const side = SIDES.find((s) => record.players[s] === submission?.player);
  if (side === undefined) return refuse("notPlayer", "That player is not in this match.");
  if (!Number.isInteger(now) || now < record.updatedAt) {
    return refuse("invalidTime", "The time must be a whole number, not earlier than the last update.");
  }
  if ("expectedSeq" in submission && submission.expectedSeq !== record.seq) {
    return refuse("staleSeq", "The game has moved on since that answer was made.");
  }
  const answer: Answer =
    "resign" in submission
      ? { system: "resign", side }
      : { decisionId: submission.decisionId, side, value: copyJson(submission.value) };
  const result = apply(ruleset, secret.state, answer);
  if (!result.ok) return { ok: false, error: result.error };
  const { state, events } = result.value;
  return {
    ok: true,
    value: {
      record: {
        ...record,
        players: { ...record.players },
        seq: state.meta.seq,
        status: copyJson(state.public.status),
        updatedAt: now,
      },
      secret: { seed: secret.seed, setup: copyJson(secret.setup), state, log: [...copyJson(secret.log), answer] },
      frames: framesFor(record.matchId, state, events),
      effects: SIDES.filter((s) => newDecision(secret.state, state, s)).map((s): HostEffect => ({
        notify: record.players[s],
      })),
    },
  };
}

/** True when `side` now has a waiting decision whose id it did not have before this answer. */
function newDecision(before: GameState, after: GameState, side: Side): boolean {
  const now = pendingFor(after, side);
  return now !== null && pendingFor(before, side)?.id !== now.id;
}

const refuse = (code: HostError["code"], message: string): HostOutcome => ({ ok: false, error: { code, message } });
