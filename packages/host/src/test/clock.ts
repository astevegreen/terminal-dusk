// Test helpers for matches with deadlines.
import type { Ruleset } from "@terminal-dusk/engine";
import { hostCreate } from "../hostCreate.ts";
import { hostDeadline } from "../hostDeadline.ts";
import type { DeadlineRule, HostResult, MatchClock, MatchDeadline } from "../types.ts";
import { makeConfig, NOW, ruleset, SEED } from "./match.ts";
import { accept, nextSide, submissionFor } from "./play.ts";

/** One day in milliseconds: the length of a one-day deadline. */
export const DAY = 86_400_000;

/** A match started at NOW with this deadline setting. */
export function startedWith(rule: DeadlineRule, days: MatchDeadline["days"] = 1): HostResult {
  const r = hostCreate(ruleset, { ...makeConfig(), deadline: { rule, days } }, SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

/** Both opening picks answered at NOW + 1 and NOW + 2, so only LIO is waited for (deadline NOW + 2 + DAY). */
export function lioToPlay(rule: DeadlineRule): HostResult {
  let host = startedWith(rule);
  host = accept(host, submissionFor(host, "lio"), NOW + 1);
  host = accept(host, submissionFor(host, "sae"), NOW + 2);
  if (nextSide(host) !== "lio") throw new Error("expected LIO to play");
  return host;
}

/** The match's clock, which these tests expect to be there. */
export function clockOf(host: HostResult): MatchClock {
  if (!host.record.clock) throw new Error("expected a clock");
  return host.record.clock;
}

/** The same match with some clock fields replaced (for cases ordinary play cannot reach in this test game). */
export function withClock(host: HostResult, change: Partial<MatchClock>): HostResult {
  return { ...host, record: { ...host.record, clock: { ...clockOf(host), ...change } } };
}

/** hostDeadline with the test ruleset, expected to succeed. */
export function swept(host: HostResult, now: number, rules: Ruleset = ruleset): HostResult {
  const r = hostDeadline(rules, host.record, host.secret, now);
  if (!r.ok) throw new Error(`hostDeadline failed: ${r.error.code}`);
  return r.value;
}
