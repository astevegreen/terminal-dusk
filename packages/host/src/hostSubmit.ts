// Taking an answer: the host's own checks, then the engine, then the new record, secret, frames and effects.
import { apply, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Answer, AnswerValue, GameState, Ruleset, Side } from "@terminal-dusk/engine";
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
  // Input may come from JSON over the wire: only `resign: true` is a resignation; any answer needs a matching whole-number expectedSeq.
  const loose = submission as Partial<Extract<Submission, { expectedSeq: number }>> & { resign?: unknown };
  const resigning = loose.resign === true;
  if (!resigning && (!Number.isInteger(loose.expectedSeq) || loose.expectedSeq !== record.seq)) {
    return refuse("staleSeq", "The game has moved on since that answer was made.");
  }
  if (!resigning && (typeof loose.decisionId !== "string" || !isObject(loose.value))) {
    return refuse("illegalAnswer", "The answer must name a decision and carry a value.");
  }
  const answer: Answer = resigning
    ? { system: "resign", side }
    : { decisionId: loose.decisionId as string, side, value: copyJson(loose.value as AnswerValue) };
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

const isObject = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v);

const refuse = (code: HostError["code"], message: string): HostOutcome => ({ ok: false, error: { code, message } });
