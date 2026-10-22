// A missed deadline: the server's deadline job (never a player) tells the host that `side` was late.
import type { Ruleset, Side } from "@terminal-dusk/engine";
import { acceptAnswer, badTime } from "./hostAccept.ts";
import type { HostOutcome, MatchRecord, MatchSecret } from "./types.ts";

/**
 * Ends the game as a loss on time for `side` (architecture Decisions 1 and 5). Refuses invalidTime the
 * same way hostSubmit does; any other refusal is the engine's (wrongSide when the game is not waiting
 * for `side`, gameOver once the game has ended). It never throws, and never changes its inputs.
 */
export function hostTimeout(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  side: Side,
  now: number,
): HostOutcome {
  const late = badTime(record, now);
  if (late) return { ok: false, error: late };
  return acceptAnswer(ruleset, record, secret, { system: "timeout", side }, now);
}
