// Contingency decks in the game state (#64, #131): the setup's checks, the shuffle, and who sees what. The
// World deck (#131) is the third deck, shared, checked and shown like the side decks.
import { describe, expect, it } from "vitest";
import { createGame, hiddenPart, reconstruct, seedHash, SIDES, viewFor } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { seedRng, shuffle } from "./rng.ts";
import { makeSetup, ruleset } from "./test/game.ts";

const withDecks = (lio: unknown, sae: unknown, world: unknown = [1, 2, 3, 4, 5, 6]): Setup =>
  ({ ...makeSetup(), contingency: { lio, sae, world } }) as Setup;
const build = (setup: Setup = makeSetup(), seed = "seed-1"): GameState => {
  const r = createGame(ruleset, { ...setup, seedHash: seedHash(seed) }, seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
};
const invalid = (setup: Setup) =>
  expect(createGame(ruleset, { ...setup, seedHash: seedHash("s") }, "s")).toMatchObject({
    ok: false,
    error: { code: "invalidSetup" },
  });

describe("the setup's Contingency decks", () => {
  it("a missing contingency returns invalidSetup", () => {
    const setup: Partial<Setup> = makeSetup();
    delete setup.contingency;
    invalid(setup as Setup);
  });
  it("a contingency that is not an object returns invalidSetup", () => {
    invalid({ ...makeSetup(), contingency: [1, 2] } as unknown as Setup);
  });
  it("a missing side's deck returns invalidSetup", () => {
    invalid({ ...makeSetup(), contingency: { lio: [1, 2, 3], world: [1, 2, 3] } } as unknown as Setup);
    invalid({ ...makeSetup(), contingency: { sae: [1, 2, 3], world: [1, 2, 3] } } as unknown as Setup);
  });
  it("the engine's Setup requires the World deck: a missing one returns invalidSetup, with no default", () => {
    invalid({ ...makeSetup(), contingency: { lio: [1, 2, 3], sae: [1, 2, 3] } } as unknown as Setup);
  });
  it("the World deck has the same checks as a side deck: at least 3 whole numbers, each 1 or more", () => {
    for (const bad of [[], [1, 2], "1,2,3", [1, 2, 0], [1, 2, 1.5], [1, 2, "3"]]) {
      invalid(withDecks([1, 2, 3], [1, 2, 3], bad));
    }
  });
  it("a side's deck that is not a list returns invalidSetup", () => {
    invalid(withDecks("1,2,3", [1, 2, 3]));
    invalid(withDecks([1, 2, 3], { 0: 1, 1: 2, 2: 3 }));
  });
  it("a deck of fewer than 3 cards returns invalidSetup", () => {
    invalid(withDecks([], [1, 2, 3]));
    invalid(withDecks([1, 2, 3], [3]));
    invalid(withDecks([1, 2], [1, 2, 3]));
    invalid(withDecks([1, 2, 3], [4, 4]));
  });
  it("a card that is not a whole number of 1 or more returns invalidSetup", () => {
    for (const bad of [0, -1, 1.5, "2", null, Number.NaN]) {
      invalid(withDecks([1, 2, bad], [1, 2, 3]));
      invalid(withDecks([1, 2, 3], [bad, 2, 3]));
    }
  });
  it("accepts a 3-card deck and a deck that repeats a number", () => {
    expect(build(withDecks([1, 2, 3], [2, 2, 5], [4, 4, 1])).public.contingency).toEqual({
      lio: { cards: [1, 2, 3], left: [1, 2, 3] },
      sae: { cards: [2, 2, 5], left: [2, 2, 5] },
      world: { cards: [1, 4, 4], left: [1, 4, 4] },
    });
  });
});

describe("the Contingency decks at the start of the game", () => {
  it("the public full contents and numbers left are the setup's cards sorted numerically: [10,2,9,2] reads [2,2,9,10]", () => {
    const s = build(withDecks([10, 2, 9, 2], [1, 2, 3, 4, 5, 6]));
    expect(s.public.contingency.lio).toEqual({ cards: [2, 2, 9, 10], left: [2, 2, 9, 10] });
    expect(s.public.contingency.sae).toEqual({ cards: [1, 2, 3, 4, 5, 6], left: [1, 2, 3, 4, 5, 6] });
  });
  it("the secret order holds each deck's cards, top card first", () => {
    const s = build(withDecks([10, 2, 9, 2], [1, 2, 3, 4, 5, 6]));
    expect([...s.secret.contingency.lio].sort((a, b) => a - b)).toEqual([2, 2, 9, 10]);
    expect([...s.secret.contingency.sae].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("shuffles the draw pile first, then LIO's deck sorted, then SAE's, then the World deck, all from one generator", () => {
    const setup = withDecks([10, 2, 9, 2], [6, 5, 4, 3, 2, 1], [8, 3, 5]);
    const s = build(setup);
    const pile = shuffle(seedRng("seed-1"), setup.deck);
    const lio = shuffle(pile.state, [2, 2, 9, 10]);
    const sae = shuffle(lio.state, [1, 2, 3, 4, 5, 6]);
    const world = shuffle(sae.state, [3, 5, 8]);
    expect(s.secret.deck).toEqual(pile.items);
    expect(s.secret.contingency).toEqual({ lio: lio.items, sae: sae.items, world: world.items });
    expect(s.secret.rng).toEqual(world.state);
  });
  it("the World deck's order is secret and its numbers left public, like the side decks", () => {
    const s = build(withDecks([1, 2, 3], [1, 2, 3], [9, 2, 7, 2]));
    expect(s.public.contingency.world).toEqual({ cards: [2, 2, 7, 9], left: [2, 2, 7, 9] });
    expect([...s.secret.contingency.world].sort((a, b) => a - b)).toEqual([2, 2, 7, 9]);
  });
  it("an unsorted deck gives the same order as the same deck sorted, for the same seed", () => {
    const unsorted = build(withDecks([10, 2, 9, 2], [6, 1, 5, 2, 4, 3]));
    const sorted = build(withDecks([2, 2, 9, 10], [1, 2, 3, 4, 5, 6]));
    expect(unsorted.secret.contingency).toEqual(sorted.secret.contingency);
  });
  it("the draw pile's order for a seed is the same as before the decks existed", () => {
    for (const seed of ["seed-1", "seed-2", "seed-3"]) {
      expect(build(makeSetup(), seed).secret.deck).toEqual(shuffle(seedRng(seed), makeSetup().deck).items);
    }
  });
  it("the same seed gives the same orders", () => {
    expect(build(makeSetup(), "seed-7").secret.contingency).toEqual(build(makeSetup(), "seed-7").secret.contingency);
  });
  it("the two sides' decks are shuffled separately: with the same cards, their orders differ for some seeds", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `seed-${i}`);
    const differ = seeds.filter((seed) => {
      const { lio, sae } = build(makeSetup(), seed).secret.contingency;
      return JSON.stringify(lio) !== JSON.stringify(sae);
    });
    expect(differ.length).toBeGreaterThan(10);
  });
  it("across 20 seeds, LIO's deck comes out in at least two orders", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => build(makeSetup(), `seed-${i}`).secret.contingency.lio.join(",")),
    );
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });
  it("the state shares no list with the setup", () => {
    const setup = withDecks([3, 1, 2], [3, 2, 1]);
    const s = build(setup);
    (setup.contingency.lio as number[]).push(9);
    expect(s.public.contingency.lio.cards).toEqual([1, 2, 3]);
  });
});

describe("who sees the Contingency decks", () => {
  it("every view, for either side and a spectator, shows all three decks' full contents and numbers left", () => {
    const s = build(withDecks([10, 2, 9, 2], [1, 2, 3]));
    for (const viewer of [...SIDES, "spectator"] as const) {
      expect(viewFor(s, viewer).public.contingency).toEqual(s.public.contingency);
    }
  });
  it("no view holds the secret order or any contingency field beyond the public one", () => {
    const s = build();
    for (const viewer of [...SIDES, "spectator"] as const) {
      const view = viewFor(s, viewer);
      expect(Object.keys(view.public.contingency.lio).sort()).toEqual(["cards", "left"]);
      expect(Object.keys(view.public.contingency.sae).sort()).toEqual(["cards", "left"]);
      expect(Object.keys(view.public.contingency.world).sort()).toEqual(["cards", "left"]);
      const { contingency, ...rest } = view.public;
      expect(contingency).toBeDefined();
      expect(JSON.stringify({ ...view, public: rest })).not.toContain("contingency");
    }
  });
  it("the secret order is in the hidden part, and reconstruct rebuilds the state", () => {
    const s = build(withDecks([10, 2, 9, 2], [1, 2, 3]));
    for (const side of SIDES) {
      expect(hiddenPart(s, side).secret.contingency).toEqual(s.secret.contingency);
      expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toEqual(s);
    }
  });
});
