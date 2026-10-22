// Test helpers for the deadline sweep: matches with deadlines in an in-memory store.
import type { Ruleset, RulesetId } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { DeadlineRule } from "@terminal-dusk/host";
import { MemoryStore } from "../store.ts";
import { submit } from "../submit.ts";
import { bodyFor, makeConfig, ruleset, SEED } from "./match.ts";

/** One day in milliseconds: the length of a one-day deadline. */
export const DAY = 86_400_000;

/** The ruleset lookup the sweep takes: it knows only the test ruleset. */
export const rulesetFor = (id: RulesetId): Ruleset | null => (id === ruleset.id ? ruleset : null);

/**
 * Puts in a one-day match `matchId` made at `at` with `rule`. Both sides wait on their opening picks,
 * so both deadlines are `at + DAY`.
 */
export function insertMatch(store: MemoryStore, matchId: string, rule: DeadlineRule, at: number): void {
  const r = hostCreate(
    ruleset,
    { ...makeConfig(matchId, { lio: "alice", sae: "bob" }), deadline: { rule, days: 1 } },
    SEED,
    at,
  );
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  store.insert(matchId, { record: r.value.record, secret: r.value.secret, frames: r.value.frames });
}

/**
 * Puts in a match like insertMatch, then LIO answers its opening pick at `at + 1`, so only SAE is waited
 * for (deadline `at + DAY`). Under lossOnTime, SAE then loses on time at that deadline.
 */
export async function insertSaeLate(
  store: MemoryStore,
  matchId: string,
  rule: DeadlineRule,
  at: number,
): Promise<void> {
  insertMatch(store, matchId, rule, at);
  const loaded = (await store.load(matchId))!;
  const body = bodyFor(0, loaded.secret, "lio");
  const deps = { store, ruleset: (id: RulesetId) => rulesetFor(id) ?? undefined };
  const result = await submit(deps, { matchId, player: "alice", body, now: at + 1 });
  if (!result.ok) throw new Error(`LIO's opening pick was refused: ${result.error.code}`);
}
