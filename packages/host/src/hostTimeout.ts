// A missed deadline: the server's deadline job (never a player) tells the host that `side` was late.
import type { Answer, Ruleset, Side } from "@terminal-dusk/engine";
import { acceptAnswer, badTime } from "./hostAccept.ts";
import type { HostOutcome, MatchRecord, MatchSecret } from "./types.ts";

/**
 * Ends the game as a loss on time for `side` (architecture Decisions 1 and 5), or as a draw when `side`
 * is "both": both sides missed one simultaneous pick that neither has made, or, with `covered`, the host played
 * for that side this turn under "defaultAnswer" and the other side is late too (#605), or, with `stuck`, the
 * host's stand-in could not answer for that late side (#629). Refuses invalidTime the
 * same way hostSubmit does; any other refusal is the engine's (wrongSide when the game is not waiting
 * for `side`, gameOver once the game has ended). It never throws, and never changes its inputs.
 */
export function hostTimeout(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  side: Side | "both",
  now: number,
  why?: { covered: Side } | { stuck: Side },
): HostOutcome {
  const late = badTime(record, now);
  if (late) return { ok: false, error: late };
  return acceptAnswer(ruleset, record, secret, timeoutFor(side, why), now);
}

function timeoutFor(side: Side | "both", why: { covered: Side } | { stuck: Side } | undefined): Answer {
  if (side !== "both") return { system: "timeout", side };
  if (why === undefined) return { system: "timeout", side };
  return "stuck" in why
    ? { system: "timeout", side, stuck: why.stuck }
    : { system: "timeout", side, covered: why.covered };
}
