// The stand-in of the "defaultAnswer" deadline rule (#605; Decision (architect) Q8 there): the host answers a
// covered side's decisions with the default answer, one after another, and saves them as one step.
import { apply, pendingFor } from "@terminal-dusk/engine";
import type { Answer, GameEvent, GameState, Ruleset, Side } from "@terminal-dusk/engine";
import { deadlineEffects } from "./clock.ts";
import { defaultAnswer } from "./defaultAnswer.ts";
import { copyJson, framesFor } from "./frames.ts";
import { commitSteps } from "./hostAccept.ts";
import type { Frame, HostOutcome, MatchClock, MatchRecord, MatchSecret } from "./types.ts";

/**
 * The most answers one stand-in call makes. Reaching it saves the answers made so far; the side stays covered and
 * due at once, so the next sweep carries on (Decision (architect), #616).
 */
export const STAND_IN_LIMIT = 64;

/**
 * Covers `side` for the turn now being played and answers its waiting decisions with the default answer until it
 * has none waiting, the turn number rises, the game ends or `limit` answers are made. Every frame is marked with
 * the covered side. When the very first answer cannot be made (no legal answer, only possible through a bug), the
 * match is parked instead: seq, state and log stay the same and the side's deadline is cleared, so the sweep stops
 * picking it up (#616). `clock` is the record's valid clock. Never changes its inputs.
 */
export function standIn(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  clock: MatchClock,
  side: Side,
  now: number,
  limit: number = STAND_IN_LIMIT,
): HostOutcome {
  const turn = secret.state.public.turn;
  const covering = { lio: clock.covering?.lio ?? null, sae: clock.covering?.sae ?? null };
  covering[side] = turn;
  let state = secret.state;
  const events: GameEvent[] = [];
  const log: Answer[] = copyJson(secret.log);
  const going = (): boolean =>
    state.public.status.kind === "active" && state.public.turn === turn && pendingFor(state, side) !== null;
  while (going() && log.length - secret.log.length < limit) {
    const answer = nextAnswer(ruleset, state, side);
    const result = answer === null ? null : apply(ruleset, state, answer);
    if (answer === null || result === null || !result.ok) {
      if (log.length === secret.log.length) return park(record, secret, clock, side, now);
      break; // save what was made; the next sweep parks it
    }
    state = result.value.state;
    events.push(...result.value.events);
    log.push(answer);
  }
  const covered: MatchRecord = { ...record, clock: { ...copyJson(clock), covering } };
  const outcome = commitSteps(ruleset, covered, secret, { state, events, log }, now);
  if (!outcome.ok) return outcome;
  const marked = (frame: Frame): Frame => ({ ...frame, standIn: side });
  const { frames } = outcome.value;
  return {
    ok: true,
    value: {
      ...outcome.value,
      frames: { lio: marked(frames.lio), sae: marked(frames.sae), spectator: marked(frames.spectator) },
    },
  };
}

/** The default answer to `side`'s waiting decision, or null when it has none or no legal answer. */
function nextAnswer(ruleset: Ruleset, state: GameState, side: Side): Answer | null {
  const decision = pendingFor(state, side);
  const value = defaultAnswer(ruleset, state, side);
  return decision === null || value === null ? null : { decisionId: decision.id, side, value };
}

/** Leaves the match as it is but clears `side`'s deadline, so no sweep picks it up again (#616). */
function park(record: MatchRecord, secret: MatchSecret, clock: MatchClock, side: Side, now: number): HostOutcome {
  const next: MatchClock = copyJson(clock);
  next.deadlines[side] = null;
  const updated: MatchRecord = { ...copyJson(record), updatedAt: now, clock: next };
  return {
    ok: true,
    value: {
      record: updated,
      secret: copyJson(secret),
      frames: framesFor(record.matchId, secret.state, []),
      effects: deadlineEffects(updated),
    },
  };
}
