// A passed deadline: the server's deadline job (never a player) asks the host to apply the match's
// deadline rule (architecture Decision 5, "Deadlines", and the product call on missed deadlines).
import { SIDES } from "@terminal-dusk/engine";
import type { Ruleset, Side } from "@terminal-dusk/engine";
import { deadlineEffects, hasGrace, isCovered, isLate, lengthOf, validClock } from "./clock.ts";
import { copyJson, framesFor } from "./frames.ts";
import { badTime } from "./hostAccept.ts";
import { standIn } from "./hostStandIn.ts";
import { hostTimeout } from "./hostTimeout.ts";
import type { HostError, HostOutcome, MatchClock, MatchRecord, MatchSecret } from "./types.ts";

/**
 * Applies the deadline rule to every side whose deadline is at or before `now`. A late side with its
 * grace extension left gets one more deadline of the same length from `now` (seq, state and log stay
 * the same); a late side without one loses on time through hostTimeout. When both sides are late and
 * neither has an extension left (always so under lossOnTime), the game ends in a draw on time through
 * hostTimeout with "both". Under "defaultAnswer" the host instead answers for the late sides for the rest of
 * the turn (hostStandIn.ts); two sides freshly late at once (neither covered yet) is that draw.
 * Refuses invalidTime like hostSubmit, gameOver for a finished game, and notDue
 * when the match has no clock or nobody is late. It never throws, and never changes its inputs.
 */
export function hostDeadline(ruleset: Ruleset, record: MatchRecord, secret: MatchSecret, now: number): HostOutcome {
  const bad = badTime(record, now);
  if (bad) return { ok: false, error: bad };
  if (record.status.kind !== "active") return refuse("gameOver", "The game is over.");
  const clock = record.clock;
  if (!validClock(clock)) return refuse("notDue", "This match has no deadlines.");
  const late = SIDES.filter((side) => isLate(clock, side, now));
  if (late.length === 0) return refuse("notDue", "No deadline has passed yet.");
  if (clock.rule === "defaultAnswer") {
    // Only sides not already covered this turn count as freshly late; two at once is a draw (owner, #605).
    const fresh = late.filter((side) => !isCovered(clock, side, secret.state));
    if (fresh.length > 1) return hostTimeout(ruleset, record, secret, "both", now);
    return standIn(ruleset, record, secret, clock, late, now);
  }
  const losers = late.filter((side) => !hasGrace(clock, side));
  if (losers.length > 1) return hostTimeout(ruleset, record, secret, "both", now);
  if (losers.length === 1) return hostTimeout(ruleset, record, secret, losers[0]!, now);
  return extend(record, secret, clock, late, now);
}

/** Gives each side in `late` its grace extension: a new deadline one length from `now`. */
function extend(record: MatchRecord, secret: MatchSecret, clock: MatchClock, late: Side[], now: number): HostOutcome {
  const next: MatchClock = copyJson(clock);
  for (const side of late) {
    next.graceUsed[side] = true;
    next.deadlines[side] = now + lengthOf(clock);
  }
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

const refuse = (code: HostError["code"], message: string): HostOutcome => ({ ok: false, error: { code, message } });
