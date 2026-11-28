// Test helpers for rated finishes (#679): small matches that are ranked and carry the official ruleset's id, so
// `isRatedFinish` accepts them, while the rules stay the small test ruleset of test/match.ts.
import { legalAnswers, pendingFor } from "@terminal-dusk/engine";
import type { Ruleset, RulesetId, Side } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { DeadlineRule, HostResult, MatchConfig, MatchSecret } from "@terminal-dusk/host";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { MemoryStore } from "../store.ts";
import type { SubmitDeps } from "../submit.ts";
import { makeConfig, NOW, ruleset, SEED } from "./match.ts";

/** The test ruleset under the official id: a game on it counts as a game on an official ruleset. */
export const officialRuleset: Ruleset = { ...ruleset, id: firstDeckRuleset.id };

/** Knows the test ruleset under both ids: its own (a modded ruleset, never rated) and the official one. */
export const rulesetFor = (id: RulesetId): Ruleset | null => {
  if (id === officialRuleset.id) return officialRuleset;
  return id === ruleset.id ? ruleset : null;
};

export const PLAYERS = { lio: "alice", sae: "bob" } as const;

export type MatchOptions = { ranked?: boolean; official?: boolean; deadline?: DeadlineRule; matchId?: string };

/** A new match between alice (LIO) and bob (SAE): ranked and official unless told otherwise. */
export function rankedMatch(options: MatchOptions = {}): HostResult {
  const { ranked = true, official = true, deadline, matchId = "ranked-1" } = options;
  const config: MatchConfig = {
    ...makeConfig(matchId, PLAYERS),
    ...(deadline ? { deadline: { rule: deadline, days: 1 } } : {}),
  };
  const made = hostCreate(official ? officialRuleset : ruleset, config, SEED, NOW);
  if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
  return ranked ? { ...made.value, record: { ...made.value.record, ranked: true } } : made.value;
}

/** An in-memory store holding `match`, and submit deps for it. */
export function rankedWorld(match: HostResult): { store: MemoryStore; deps: SubmitDeps } {
  const store = new MemoryStore();
  store.insert(match.record.matchId, { record: match.record, secret: match.secret, frames: match.frames });
  return { store, deps: { store, ruleset: (id) => rulesetFor(id) ?? undefined, notify: undefined } };
}

/** The wire body answering `side`'s waiting decision with its first legal answer, in a match on `officialRuleset`. */
export function officialBody(seq: number, secret: MatchSecret, side: Side): Record<string, unknown> {
  const decision = pendingFor(secret.state, side);
  const value = legalAnswers(officialRuleset, secret.state, side)[0];
  if (!decision || !value) throw new Error(`${side} has nothing to answer`);
  return { decisionId: decision.id, expectedSeq: seq, value };
}
