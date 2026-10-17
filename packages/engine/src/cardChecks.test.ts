// createGame's card checks: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { CardDef, EngineErrorCode, Ruleset, Setup } from "./index.ts";
import { makeSetup, ruleset, testCard } from "./test/game.ts";

/** The test ruleset (cards c1 to c6) with `cards` in place of its own. */
const withCards = (cards: readonly CardDef[]): Ruleset => ({ ...ruleset, cards });
/** "ok", or the error code createGame returns. */
function outcome(rs: Ruleset, setup: Setup = makeSetup()): "ok" | EngineErrorCode {
  const r = createGame(rs, setup, "seed-1");
  return r.ok ? "ok" : r.error.code;
}
/** makeSetup's cards (LIO c1 c2, SAE c3, draw pile c4 to c6), with some lists replaced. */
const setupWith = (lists: { lio?: string[]; sae?: string[]; deck?: string[] }): Setup => {
  const base = makeSetup();
  return {
    ...base,
    hands: { lio: lists.lio ?? base.hands.lio, sae: lists.sae ?? base.hands.sae },
    deck: lists.deck ?? base.deck,
  };
};

describe("createGame: the ruleset's cards", () => {
  it("accepts the test ruleset, and a card with 0 ops", () => {
    expect(outcome(ruleset)).toBe("ok");
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("c1", 0)]))).toBe("ok");
  });
  it("accepts a ruleset holding cards no hand or draw pile uses, such as a later era's", () => {
    expect(outcome(withCards([...ruleset.cards, { ...testCard("c99"), era: "later" }]))).toBe("ok");
  });
  it("returns invalidRuleset when two cards share an id", () => {
    expect(outcome(withCards([...ruleset.cards, testCard("c2", 3)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when a card's ops is negative", () => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("c1", -1)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when a card's ops is not a whole number", () => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("c1", 1.5)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when the ruleset has no card list", () => {
    expect(outcome({ id: ruleset.id } as Ruleset)).toBe("invalidRuleset");
  });
});

describe("createGame: a setup uses only known cards, each once", () => {
  it.each([
    ["LIO's hand", { lio: ["c1", "c2", "c99"] }],
    ["SAE's hand", { sae: ["c3", "c99"] }],
    ["the draw pile", { deck: ["c4", "c99", "c5", "c6"] }],
  ])("returns invalidSetup for a card the ruleset doesn't have, in %s", (_place, lists) => {
    expect(outcome(ruleset, setupWith(lists))).toBe("invalidSetup");
  });
  it.each([
    ["both copies in the draw pile", { deck: ["c4", "c5", "c4", "c6"] }],
    ["a copy in each hand", { sae: ["c3", "c1"] }],
    ["a copy in a hand and a copy in the draw pile", { deck: ["c4", "c5", "c6", "c2"] }],
  ])("returns invalidSetup for the same card twice: %s", (_place, lists) => {
    expect(outcome(ruleset, setupWith(lists))).toBe("invalidSetup");
  });
});
