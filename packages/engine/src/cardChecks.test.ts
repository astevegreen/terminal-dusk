// createGame's card checks: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { CardDef, EngineErrorCode, Ruleset, Setup, Step } from "./index.ts";
import { choose, forEach, ifYes, makeSetup, ruleset, testCard } from "./test/game.ts";

/** The test ruleset with `cards` in place of its own. */
const withCards = (cards: readonly CardDef[]): Ruleset => ({ ...ruleset, cards });
/** "ok", or the error code createGame returns. */
function outcome(rs: Ruleset, setup: Setup = makeSetup()): "ok" | EngineErrorCode {
  const r = createGame(rs, setup, "seed-1");
  return r.ok ? "ok" : r.error.code;
}
/** makeSetup's cards (LIO l1-l4 n1, SAE s1-s4 n2, draw pile z1-z3), with some lists replaced. */
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
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 0, "lio")]))).toBe("ok");
  });
  it("accepts a ruleset holding cards no hand or draw pile uses, such as a later era's", () => {
    expect(outcome(withCards([...ruleset.cards, { ...testCard("c99"), era: "later" }]))).toBe("ok");
  });
  it("returns invalidRuleset when two cards share an id", () => {
    expect(outcome(withCards([...ruleset.cards, testCard("l2", 3)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when a card's ops is negative", () => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("l1", -1)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when a card's ops is not a whole number", () => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 1.5)]))).toBe("invalidRuleset");
  });
  it("returns invalidRuleset when the ruleset has no card list", () => {
    expect(outcome({ id: ruleset.id } as Ruleset)).toBe("invalidRuleset");
  });
});

describe("createGame: a setup uses only known cards, each once", () => {
  it.each([
    ["LIO's hand", { lio: [...makeSetup().hands.lio, "c99"] }],
    ["SAE's hand", { sae: [...makeSetup().hands.sae, "c99"] }],
    ["the draw pile", { deck: ["z1", "c99", "z2", "z3"] }],
  ])("returns invalidSetup for a card the ruleset doesn't have, in %s", (_place, lists) => {
    expect(outcome(ruleset, setupWith(lists))).toBe("invalidSetup");
  });
  it.each([
    ["both copies in the draw pile", { deck: ["z1", "z2", "z1", "z3"] }],
    ["a copy in each hand", { sae: [...makeSetup().hands.sae, "l1"] }],
    ["a copy in a hand and a copy in the draw pile", { deck: ["z1", "z2", "z3", "l2"] }],
  ])("returns invalidSetup for the same card twice: %s", (_place, lists) => {
    expect(outcome(ruleset, setupWith(lists))).toBe("invalidSetup");
  });
});

describe("createGame: no card's effect holds a card choice", () => {
  const pickBoth: Step = { op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "c" };
  it.each([
    ["at the top", [pickBoth]],
    ["inside an if", [choose("go"), ifYes("go", [pickBoth])]],
    ["inside a forEach", [forEach(["a"], "x", [pickBoth])]],
  ])("returns invalidRuleset for a card choice %s of a card's effect", (_where, effect) => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 1, "lio", effect)]))).toBe("invalidRuleset");
  });
  it("accepts a card whose effect holds a yes/no choice", () => {
    expect(outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 1, "lio", [choose("go")])]))).toBe("ok");
  });
});

// TEMPORARY, like the check itself: until hands are refilled, each side needs enough non-neutral cards
// for the whole game, turns x (1 + playsPerTurn).
describe("createGame: each hand holds turns x (1 + playsPerTurn) non-neutral cards (temporary)", () => {
  it.each([
    [1, 1],
    [2, 1],
    [2, 3],
  ])("exactly enough is accepted: %i turns, %i plays", (turns, plays) => {
    const setup = makeSetup(turns, plays);
    expect(setup.hands.lio.filter((c) => c !== "n1")).toHaveLength(turns * (1 + plays));
    expect(outcome(ruleset, setup)).toBe("ok");
  });
  it.each(["lio", "sae"] as const)("one fewer in %s's hand is rejected with invalidSetup", (side) => {
    const base = makeSetup(2, 1);
    const short = { ...base, hands: { ...base.hands, [side]: base.hands[side].slice(1) } };
    expect(outcome(ruleset, short)).toBe("invalidSetup");
  });
  it("extra neutral cards don't make up the shortfall", () => {
    const base = makeSetup(2, 1);
    const short = { ...base, hands: { ...base.hands, lio: [...base.hands.lio.slice(1), "z1", "z2", "z3"] }, deck: [] };
    expect(outcome(ruleset, short)).toBe("invalidSetup");
  });
  it("the error names the side and how many cards it needs", () => {
    const base = makeSetup(2, 1);
    const r = createGame(ruleset, { ...base, hands: { ...base.hands, sae: ["s1", "n2"] } }, "seed-1");
    expect(r).toMatchObject({ ok: false, error: { code: "invalidSetup", message: expect.stringContaining("SAE") } });
    expect(!r.ok && r.error.message).toContain("need 4");
  });
});
