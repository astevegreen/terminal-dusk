import { describe, expect, it } from "vitest";
import { createGame, seedHash, SIDES } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { seedRng, shuffle } from "./rng.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeSetup as baseSetup, ruleset as baseRuleset, testCard } from "./test/game.ts";

/** Nine cards, so a shuffled pile has 9! orders and two seeds giving the same one is vanishingly rare. */
const PILE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
const ruleset = { ...baseRuleset, cards: [...baseRuleset.cards, ...PILE.map((id) => testCard(id))] };
/** The shared test setup (2 turns, 1 play each), with `deck` as its draw pile. */
const makeSetup = (deck: string[] = ["p1", "p2", "p3"], seed = "seed-1"): Setup => ({ ...baseSetup(2, 1, seed), deck });
/** A setup carrying the true hash of "s", the seed the setup-error tests use. */
const forS = (setup: Setup): Setup => ({ ...setup, seedHash: seedHash("s") });
const build = (seed = "seed-1", deck?: string[]): GameState => {
  const r = createGame(ruleset, makeSetup(deck, seed), seed);
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
    expect(s.meta).toEqual({ ruleset: "test-ruleset", seedHash: seedHash("seed-1"), seq: 0 });
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
  it("at game start the decks are shuffled in a fixed order: the draw pile, then LIO's, SAE's and the World Contingency decks, each sorted first", () => {
    // Intended change (#64): the Contingency decks are shuffled after the draw pile; (#131) the World deck last.
    const deck = ["p1", "p2"];
    const contingency = { lio: [10, 2, 9, 2], sae: [1, 2, 3, 4, 5, 6], world: [7, 3, 1, 2] };
    const setup: Setup = { ...makeSetup(deck), contingency };
    const r = createGame(ruleset, setup, "seed-1");
    if (!r.ok) throw new Error("expected ok");
    const pile = shuffle(seedRng("seed-1"), deck);
    const lio = shuffle(pile.state, [2, 2, 9, 10]);
    const sae = shuffle(lio.state, [1, 2, 3, 4, 5, 6]);
    const world = shuffle(sae.state, [1, 2, 3, 7]);
    expect(r.value.state.secret.contingency).toEqual({ lio: lio.items, sae: sae.items, world: world.items });
    expect(r.value.state.secret.rng).toEqual(world.state);
    expect(r.value.state.secret.rng).not.toEqual(seedRng("seed-1"));
  });
  it("missing hands, a missing side's hand, or a missing deck returns invalidSetup", () => {
    const bad: unknown[] = [
      { seedHash: seedHash("s"), deck: [] },
      { seedHash: seedHash("s"), hands: { sae: [] }, deck: [] },
      { seedHash: seedHash("s"), hands: { lio: [] }, deck: [] },
      { seedHash: seedHash("s"), hands: { lio: [], sae: [] } },
      { seedHash: seedHash("s"), hands: { lio: "x", sae: [] }, deck: [] },
      { seedHash: seedHash("s"), hands: null, deck: [] },
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
      const setup = forS({ ...makeSetup(), [field]: value } as Setup);
      expect(createGame(ruleset, setup, "s")).toMatchObject({ ok: false, error: { code: "invalidSetup" } });
    }
  });
  it("turns and playsPerTurn of 1 or more are accepted, and stored in the public compartment", () => {
    const setup = forS({ ...baseSetup(3, 2), deck: [] });
    const r = createGame(ruleset, setup, "s");
    expect(r.ok && r.value.state.public).toMatchObject({ turns: 3, playsPerTurn: 2 });
  });
  it("an empty seed returns invalidSeed", () => {
    const r = createGame(ruleset, forS(makeSetup()), "");
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
  it("a seedHash that is the true hash of the seed is accepted", () => {
    expect(createGame(ruleset, makeSetup([], "seed-9"), "seed-9").ok).toBe(true);
  });
  it("a seedHash that is the hash of a different seed returns seedMismatch", () => {
    const setup = { ...makeSetup(), seedHash: seedHash("seed-2") };
    expect(createGame(ruleset, setup, "seed-1")).toMatchObject({ ok: false, error: { code: "seedMismatch" } });
  });
  it("the true hash in upper case returns seedMismatch", () => {
    const setup = { ...makeSetup(), seedHash: seedHash("seed-1").toUpperCase() };
    expect(createGame(ruleset, setup, "seed-1")).toMatchObject({ ok: false, error: { code: "seedMismatch" } });
  });
  it("the seedMismatch message includes neither the seed nor the true hash", () => {
    const seed = "zQ-distinctive-seed-9917";
    const r = createGame(ruleset, { ...makeSetup(), seedHash: seedHash("other") }, seed);
    expect(r).toMatchObject({ ok: false, error: { code: "seedMismatch" } });
    const message = r.ok ? "" : r.error.message;
    expect(message).not.toContain(seed);
    expect(message).not.toContain(seedHash(seed));
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
