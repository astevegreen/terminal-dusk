// Test helpers: a small ruleset, a match config with an era still to enter, and a seed.
import type { CardDef, CardId, Ruleset, Side } from "@terminal-dusk/engine";
import type { MatchConfig } from "../types.ts";

export const SEED = "host-seed-1";
export const NOW = 1_700_000_000_000;

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
/** The cards of the era that enters on turn 2, so they wait in the secret compartment at the start. */
export const LATE_ERA_CARDS = ["e1", "e2"];

/** The test ruleset: LIO's l1-l4, SAE's s1-s4, neutral n1, n2, the draw pile z1-z3 and the era cards e1, e2. */
export const ruleset: Ruleset = {
  id: "host-test-ruleset",
  cards: [...LIO, ...SAE, "n1", "n2", ...DECK, ...LATE_ERA_CARDS].map(card),
};

/** A two-turn match, one play per turn, between alice (LIO) and bob (SAE), with one era entering on turn 2. */
export const makeConfig = (): MatchConfig => ({
  matchId: "match-1",
  players: { lio: "alice", sae: "bob" },
  setup: {
    hands: { lio: [...LIO, "n1"], sae: [...SAE, "n2"] },
    deck: [...DECK],
    turns: 2,
    playsPerTurn: 1,
    // The smallest hand size: the dealt hands never drop below it, so these matches draw no cards.
    handSize: 2,
    eras: [{ era: "late", turn: 2, cards: [...LATE_ERA_CARDS] }],
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
  },
});
