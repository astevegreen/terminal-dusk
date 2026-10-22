// Taking an answer: the host's own checks, then the engine, then the new record, secret, frames and effects.
import { SIDES } from "@terminal-dusk/engine";
import type { Answer, AnswerValue, Ruleset } from "@terminal-dusk/engine";
import { copyJson } from "./frames.ts";
import { acceptAnswer, badTime } from "./hostAccept.ts";
import type { HostError, HostOutcome, MatchRecord, MatchSecret, Submission } from "./types.ts";

/**
 * Takes one player's answer or resignation. The host checks, in order: notPlayer, invalidTime, staleSeq;
 * only then does the engine see the answer (so a game-ending move sent twice gives staleSeq, not gameOver).
 * A player can never send a timeout: only hostTimeout makes one.
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
  const late = badTime(record, now);
  if (late) return { ok: false, error: late };
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
  return acceptAnswer(ruleset, record, secret, answer, now);
}

const isObject = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v);

const refuse = (code: HostError["code"], message: string): HostOutcome => ({ ok: false, error: { code, message } });
