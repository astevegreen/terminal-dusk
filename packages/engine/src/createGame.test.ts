import { describe, expect, it } from "vitest";
import { createGame, SIDES } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { seedRng, shuffle } from "./rng.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeSetup as baseSetup, ruleset as baseRuleset, testCard } from "./test/game.ts";

/** Nine cards, so a shuffled pile has 9! orders and two seeds giving the same one is vanishingly rare. */
const PILE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
const ruleset = { ...baseRuleset, cards: [...baseRuleset.cards, ...PILE.map((id) => testCard(id))] };
/** The shared test setup (2 turns, 1 play each), with `deck` as its draw pile. */
const makeSetup = (deck: string[] = ["p1", "p2", "p3"]): Setup => ({ ...baseSetup(), deck });
const build = (seed = "seed-1", deck?: string[]): GameState => {
  const r = createGame(ruleset, makeSetup(deck), seed);
  if (!r.ok) throw new Error("expected ok");
  return r.value.state;
};
const numbers = (v: unknown): number[] =>
  typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];

describe("createGame", () => {
  it("SIDES lists lio then sae", () => {
    expect(SIDES).toEqual(["lio", "sae"]);
  });
  it("keeps the hands in the order given, with turn 1, no plays made, nothing in play, seq 0, empty discard", () => {
    const s = build();
    expect(s.private.lio.hand).toEqual(makeSetup().hands.lio);
    expect(s.private.sae.hand).toEqual(makeSetup().hands.sae);
    expect(s.public).toMatchObject({ turn: 1, turns: 2, playsPerTurn: 1, playsMade: 0, inPlay: [], discard: [] });
    expect(s.meta).toEqual({ ruleset: "test-ruleset", seedHash: "abc123", seq: 0 });
  });
  it("returns no events", () => {
    const r = createGame(ruleset, makeSetup(), "seed-1");
    expect(r.ok && r.value.events).toEqual([]);
  });
  it("shuffles the draw pile with shuffle on the generator seeded from the game's seed", () => {
    expect(build("seed-1", PILE).secret.deck).toEqual(shuffle(seedRng("seed-1"), PILE).items);
  });
  it("the shuffled draw pile holds exactly the given card IDs, each once", () => {
    expect([...build("seed-1", PILE).secret.deck].sort()).toEqual([...PILE].sort());
  });
  it("the same seed always gives the same order", () => {
    expect(build("seed-7", PILE).secret.deck).toEqual(build("seed-7", PILE).secret.deck);
  });
  it("across 20 different seeds, at least two orders differ", () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => build(`seed-${i}`, PILE).secret.deck.join(",")));
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });
  it("accepts an empty or one-card draw pile", () => {
    expect(build("seed-1", []).secret.deck).toEqual([]);
    expect(build("seed-1", ["p1"]).secret.deck).toEqual(["p1"]);
  });
  it("secret.rng holds the generator state after the shuffles (draw pile, then LIO's and SAE's Contingency decks, each sorted first)", () => {
    // Intended change (#64): the two Contingency decks are now shuffled after the draw pile.
    const deck = ["p1", "p2"];
    const setup: Setup = { ...makeSetup(deck), contingency: { lio: [10, 2, 9, 2], sae: [1, 2, 3, 4, 5, 6] } };
    const r = createGame(ruleset, setup, "seed-1");
    if (!r.ok) throw new Error("expected ok");
    const pile = shuffle(seedRng("seed-1"), deck);
    const lio = shuffle(pile.state, [2, 2, 9, 10]);
    const sae = shuffle(lio.state, [1, 2, 3, 4, 5, 6]);
    expect(r.value.state.secret.rng).toEqual(sae.state);
    expect(r.value.state.secret.rng).not.toEqual(seedRng("seed-1"));
  });
  it("missing hands, a missing side's hand, or a missing deck returns invalidSetup", () => {
    const bad: unknown[] = [
      { seedHash: "h", deck: [] },
      { seedHash: "h", hands: { sae: [] }, deck: [] },
      { seedHash: "h", hands: { lio: [] }, deck: [] },
      { seedHash: "h", hands: { lio: [], sae: [] } },
      { seedHash: "h", hands: { lio: "x", sae: [] }, deck: [] },
      { seedHash: "h", hands: null, deck: [] },
    ];
    for (const setup of bad) {
      expect(createGame(ruleset, setup as Setup, "s")).toMatchObject({
        ok: false,
        error: { code: "invalidSetup" },
      });
    }
  });
  it.each(["turns", "playsPerTurn"])("%s of 0, below 0, a fraction or missing returns invalidSetup", (field) => {
    for (const value of [0, -1, 1.5, undefined]) {
      const setup = { ...makeSetup(), [field]: value } as Setup;
      expect(createGame(ruleset, setup, "s")).toMatchObject({ ok: false, error: { code: "invalidSetup" } });
    }
  });
  it("turns and playsPerTurn of 1 or more are accepted, and stored in the public compartment", () => {
    const setup = { ...baseSetup(3, 2), deck: [] };
    const r = createGame(ruleset, setup, "s");
    expect(r.ok && r.value.state.public).toMatchObject({ turns: 3, playsPerTurn: 2 });
  });
  it("an empty seed returns invalidSeed", () => {
    const r = createGame(ruleset, makeSetup(), "");
    expect(r).toMatchObject({ ok: false, error: { code: "invalidSeed" } });
  });
  it("a missing or empty seedHash returns invalidSetup", () => {
    const empty = { ...makeSetup(), seedHash: "" };
    expect(createGame(ruleset, empty, "s")).toMatchObject({ ok: false, error: { code: "invalidSetup" } });
    const missing: Partial<Setup> = makeSetup();
    delete missing.seedHash;
    expect(createGame(ruleset, missing as Setup, "s")).toMatchObject({
      ok: false,
      error: { code: "invalidSetup" },
    });
  });
  it("stores the seed string nowhere in the state", () => {
    expect(JSON.stringify(build("zQ-distinctive-seed-9917"))).not.toContain("zQ-distinctive-seed-9917");
  });
  it("does not change deep-frozen inputs, including the ruleset and its cards", () => {
    const setup = deepFreeze(makeSetup(PILE));
    const rs = deepFreeze({ ...ruleset, cards: ruleset.cards.map((c) => ({ ...c })) });
    expect(createGame(rs, setup, "seed-1").ok).toBe(true);
  });
  it("state survives a JSON round trip unchanged", () => {
    const s = build();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it("every number in the state is an integer", () => {
    for (const n of numbers(build())) expect(Number.isInteger(n)).toBe(true);
  });
});
