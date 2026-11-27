// A stacked top of the draw pile (#637): `Setup.deckTop` lists the first cards drawn, in order, for a scripted
// scenario such as the tutorial. The rest of the deck is shuffled by the seeded generator exactly as without it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createGame, seedHash } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { makeSetup as baseSetup, ruleset as baseRuleset, testCard } from "./test/game.ts";
import { byCodeUnit } from "./test/sort.ts";

const PILE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"];
const ruleset = { ...baseRuleset, cards: [...baseRuleset.cards, ...PILE.map((id) => testCard(id))] };
const setupFor = (seed: string, deckTop?: string[]): Setup => ({
  ...baseSetup(2, 1, seed),
  deck: PILE,
  ...(deckTop === undefined ? {} : { deckTop }),
});
const build = (seed: string, deckTop?: string[]): GameState => {
  const r = createGame(ruleset, setupFor(seed, deckTop), seed);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.state;
};
const TOP = ["p7", "p2", "p11", "p1"];

describe("Setup.deckTop", () => {
  it("over many seeds, the first draws equal deckTop and the rest is the deck minus deckTop", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (seed) => {
        const deck = build(seed, TOP).secret.deck;
        expect(deck.slice(0, TOP.length)).toEqual(TOP);
        const rest = PILE.filter((c) => !TOP.includes(c));
        expect(deck.slice(TOP.length).toSorted(byCodeUnit)).toEqual(rest.toSorted(byCodeUnit));
      }),
      { numRuns: 200 },
    );
  });
  it("the order of the rest changes with the seed", () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => build(`seed-${i}`, TOP).secret.deck.join(",")));
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });
  it("the rest is shuffled by the seeded generator as a deck without the listed cards would be", () => {
    const seed = "seed-3";
    const rest = PILE.filter((c) => !TOP.includes(c));
    const r = createGame(ruleset, { ...setupFor(seed), deck: rest }, seed);
    if (!r.ok) throw new Error("expected ok");
    expect(build(seed, TOP).secret.deck.slice(TOP.length)).toEqual(r.value.state.secret.deck);
    expect(build(seed, TOP).secret.contingency).toEqual(r.value.state.secret.contingency);
    expect(build(seed, TOP).secret.rng).toEqual(r.value.state.secret.rng);
  });
  it("leaving deckTop out, or giving an empty list, is exactly today's game", () => {
    expect(build("seed-5", [])).toEqual(build("seed-5"));
  });
  it("the draws from the top go to LIO first, then SAE, at the turn's refill", () => {
    const seed = "seed-9";
    const setup: Setup = {
      ...setupFor(seed, ["p5", "p6", "p8", "p9"]),
      hands: { lio: ["l1"], sae: ["s1"] },
      handSize: 3,
    };
    const r = createGame(ruleset, setup, seed);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.state.private.lio.hand).toEqual(["l1", "p5", "p6"]);
    expect(r.value.state.private.sae.hand).toEqual(["s1", "p8", "p9"]);
  });
  it("a listed card that is not in the deck is invalidSetup", () => {
    const r = createGame(ruleset, setupFor("s", ["p1", "l1"]), "s");
    expect(r.ok ? null : r.error.code).toBe("invalidSetup");
  });
  it("a card listed twice is invalidSetup", () => {
    const r = createGame(ruleset, setupFor("s", ["p1", "p1"]), "s");
    expect(r.ok ? null : r.error.code).toBe("invalidSetup");
  });
  it("a deckTop that is not a list of card ids is invalidSetup", () => {
    const bad = { ...setupFor("s"), deckTop: "p1" } as unknown as Setup;
    const r = createGame(ruleset, bad, "s");
    expect(r.ok ? null : r.error.code).toBe("invalidSetup");
  });
  it("never changes the setup it is given", () => {
    const setup = setupFor("seed-2", TOP);
    const copy = JSON.parse(JSON.stringify(setup)) as Setup;
    createGame(ruleset, Object.freeze(setup), "seed-2");
    expect(setup).toEqual(copy);
    expect(setup.seedHash).toBe(seedHash("seed-2"));
  });
});
