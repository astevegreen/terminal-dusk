// Test helpers: a small ruleset and a match in an in-memory store, copying the idea of the host's tests.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { CardDef, CardId, Ruleset, Side } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { HostResult, MatchConfig, MatchSecret } from "@terminal-dusk/host";
import { MemoryStore } from "../store.ts";
import type { SubmitDeps } from "../submit.ts";

export const SEED = "server-seed-1";
export const NOW = 1_700_000_000_000;
export const MATCH = "match-1";

const affiliationOf = (id: CardId): Side | "neutral" => {
  if (id.startsWith("l")) return "lio";
  return id.startsWith("s") ? "sae" : "neutral";
};
/** A one-ops card with no effect. Its era is "late" for the era cards (IDs starting with "e"), else "test". */
const card = (id: CardId): CardDef => ({
  id,
  era: id.startsWith("e") ? "late" : "test",
  ops: 1,
  affiliation: affiliationOf(id),
  effect: [],
});

const LIO = ["l1", "l2", "l3", "l4"];
const SAE = ["s1", "s2", "s3", "s4"];
const DECK = ["z1", "z2", "z3"];
const LATE_ERA_CARDS = ["e1", "e2"];

export const ruleset: Ruleset = {
  id: "server-test-ruleset",
  cards: [...LIO, ...SAE, "n1", "n2", ...DECK, ...LATE_ERA_CARDS].map(card),
};

/** A two-turn match, one play per turn, between the given players, with one era entering on turn 2. */
const makeConfig = (matchId: string, players: MatchConfig["players"]): MatchConfig => ({
  matchId,
  players,
  setup: {
    hands: { lio: [...LIO, "n1"], sae: [...SAE, "n2"] },
    deck: [...DECK],
    turns: 2,
    playsPerTurn: 1,
    handSize: 2,
    eras: [{ era: "late", turn: 2, cards: [...LATE_ERA_CARDS] }],
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  },
});

/** A match just made by hostCreate: by default "match-1" between alice and bob. */
export function created(matchId = MATCH, players: MatchConfig["players"] = { lio: "alice", sae: "bob" }): HostResult {
  const r = hostCreate(ruleset, makeConfig(matchId, players), SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

/** An in-memory store holding a new match, and deps that know only the test ruleset. */
export function setup(): { store: MemoryStore; deps: SubmitDeps; start: HostResult } {
  const start = created();
  const store = new MemoryStore();
  store.insert(MATCH, { record: start.record, secret: start.secret, frames: start.frames });
  const deps: SubmitDeps = { store, ruleset: (id) => (id === ruleset.id ? ruleset : undefined) };
  return { store, deps, start };
}

/** The wire body answering `side`'s waiting decision with its legal answer number `pick`. */
export function bodyFor(seq: number, secret: MatchSecret, side: Side, pick = 0): Record<string, unknown> {
  const decision = pendingFor(secret.state, side);
  const value = legalAnswers(ruleset, secret.state, side)[pick];
  if (!decision || !value) throw new Error(`${side} has nothing to answer`);
  return { decisionId: decision.id, expectedSeq: seq, value };
}

/** The first side with a waiting decision. */
export const nextSide = (secret: MatchSecret): Side => {
  const side = SIDES.find((s) => pendingFor(secret.state, s) !== null);
  if (!side) throw new Error("nobody is waiting");
  return side;
};
