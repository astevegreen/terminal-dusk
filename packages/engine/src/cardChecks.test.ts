// createGame's card checks: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { CardDef, EngineErrorCode, Ruleset, Setup, Side, Step } from "./index.ts";
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

/** A trigger step, "at the turn's end, run `reaction`", with any of its fields replaced by `fields`. */
const trigger = (fields: object = {}, reaction: Step[] = [{ op: "marker", label: "m" }]): Step =>
  ({ op: "trigger", hook: "turnEnd", do: reaction, duration: { kind: "turnEnd" }, ...fields }) as Step;
/** `step` at the top of an effect, in an if's then and else, in a forEach and in a trigger's reaction. */
const nested = (step: Step): Step[][] => [
  [step],
  [choose("go"), ifYes("go", [step])],
  [choose("go"), ifYes("go", [], [step])],
  [forEach(["a"], "x", [step])],
  [trigger({}, [step])],
];
/** "ok", or the error code createGame returns, with LIO's card l1 given `effect`. */
const outcomeOf = (effect: Step[]) => outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 1, "lio", effect)]));

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
  it.each([
    ["missing", undefined],
    ["not a string", 7],
    ["empty", ""],
  ])("returns invalidRuleset when the ruleset id is %s", (_what, id) => {
    expect(outcome({ ...ruleset, id } as unknown as Ruleset)).toBe("invalidRuleset");
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

describe("createGame: a side's card draws only from its own deck, a neutral card from the player's", () => {
  const draw = (side: Side | "player"): Step => ({ op: "drawContingency", side });
  const placements = (step: Step): [string, Step[]][] => [
    ["at the top", [step]],
    ["inside an if's then", [choose("go"), ifYes("go", [step])]],
    ["inside an if's else", [choose("go"), ifYes("go", [], [step])]],
    ["inside a forEach", [forEach(["a"], "x", [step])]],
    ["inside a trigger's reaction", [trigger({}, [step])]],
  ];
  const outcomeOf = (affiliation: Side | "neutral", effect: Step[]) =>
    outcome(withCards([...ruleset.cards.slice(1), testCard("l1", 1, affiliation, effect)]));
  /** The outcome when the neutral card n1, in LIO's hand, has `effect`. */
  const neutralOutcome = (effect: Step[]) =>
    outcome(withCards(ruleset.cards.map((c) => (c.id === "n1" ? testCard("n1", 1, "neutral", effect) : c))));

  it.each([
    ["lio", "sae"],
    ["sae", "lio"],
  ] as const)("refuses a %s card drawing from %s's deck", (own, other) => {
    for (const [, effect] of placements(draw(other))) expect(outcomeOf(own, effect)).toBe("invalidRuleset");
  });
  it.each(["lio", "sae"] as const)("refuses a neutral card drawing from %s's deck", (side) => {
    for (const [, effect] of placements(draw(side))) expect(neutralOutcome(effect)).toBe("invalidRuleset");
  });
  it.each(["lio", "sae"] as const)("accepts a %s card drawing from its own deck, at any depth", (side) => {
    for (const [, effect] of placements(draw(side))) expect(outcomeOf(side, effect)).toBe("ok");
  });
  it("names the card and both sides in the error", () => {
    const rs = withCards([...ruleset.cards.slice(1), testCard("l1", 1, "lio", [draw("sae")])]);
    const r = createGame(rs, makeSetup(), "seed-1");
    expect(!r.ok && r.error.message).toBe("Card l1 is an LIO card, but its event draws from SAE's Contingency deck.");
  });
  it("accepts a neutral card drawing from the deck of the side that played it, at any depth", () => {
    for (const [, effect] of placements(draw("player"))) expect(neutralOutcome(effect)).toBe("ok");
  });
  it.each(["lio", "sae"] as const)("refuses a %s card drawing from the deck of the side that played it", (side) => {
    for (const [, effect] of placements(draw("player"))) expect(outcomeOf(side, effect)).toBe("invalidRuleset");
  });
  it("tells a neutral card naming a side's deck to draw from the player's deck", () => {
    const rs = withCards([...ruleset.cards.slice(1), testCard("l1", 1, "neutral", [draw("lio")])]);
    const r = createGame(rs, makeSetup(), "seed-1");
    expect(!r.ok && r.error.message).toBe(
      'Card l1 is a neutral card, but its event draws from LIO\'s Contingency deck; a neutral event draws from the deck of the side that played it ("side": "player").',
    );
  });
  it("tells a side's card drawing from the player's deck to use its own deck", () => {
    const rs = withCards([...ruleset.cards.slice(1), testCard("l1", 1, "sae", [draw("player")])]);
    const r = createGame(rs, makeSetup(), "seed-1");
    expect(!r.ok && r.error.message).toBe(
      "Card l1 is an SAE card, but its event draws from the deck of the side that played it; an SAE event draws from SAE's Contingency deck.",
    );
  });
});

describe("createGame: a card's number steps hold whole numbers", () => {
  const badAdd = (amount: number): Step => ({ op: "addToNumber", var: "n", amount });
  const badTest = (value: number): Step => ({ op: "if", cond: { op: "atLeast", var: "n", value }, then: [] });

  it.each([0, 1.5, Number.NaN])("refuses an addToNumber amount of %s, at any depth", (amount) => {
    for (const effect of nested(badAdd(amount))) expect(outcomeOf(effect)).toBe("invalidRuleset");
  });
  it.each([0.5, Number.NaN, Infinity])("refuses a number test value of %s, at any depth", (value) => {
    for (const effect of nested(badTest(value))) expect(outcomeOf(effect)).toBe("invalidRuleset");
  });
  it("accepts whole amounts and values, negative and zero values included", () => {
    for (const effect of nested(badAdd(-2))) expect(outcomeOf(effect)).toBe("ok");
    for (const effect of nested(badTest(0))) expect(outcomeOf(effect)).toBe("ok");
  });
});

describe("createGame: a card's modifier steps hold values the engine knows", () => {
  const good = { hook: "opsValue", side: "both", add: -1, min: 1 };
  const modifier = (mod: object, duration: object = { kind: "turnEnd" }): Step =>
    ({ op: "modifier", mod, duration }) as unknown as Step;

  it.each([
    ["an unknown hook", modifier({ ...good, hook: "coupResult" })],
    ["an add of 0", modifier({ ...good, add: 0 })],
    ["an add that is not whole", modifier({ ...good, add: 1.5 })],
    ["a missing add", modifier({ hook: "opsValue", side: "both" })],
    ["a negative min", modifier({ ...good, min: -1 })],
    ["a min that is not whole", modifier({ ...good, min: 0.5 })],
    ["an unknown duration", modifier(good, { kind: "gameEnd" })],
    ["a side that is not lio, sae or both", modifier({ ...good, side: "neutral" })],
  ])("returns invalidRuleset for a modifier with %s, at the top and nested in an if and a forEach", (_what, step) => {
    for (const effect of nested(step)) expect(outcomeOf(effect)).toBe("invalidRuleset");
  });
  it("accepts good modifiers at any depth: each side, a negative or positive add, a min of 0 or none", () => {
    const steps = [
      modifier(good),
      modifier({ hook: "opsValue", side: "lio", add: 2 }),
      modifier({ hook: "opsValue", side: "sae", add: -2, min: 0 }),
    ];
    for (const step of steps) for (const effect of nested(step)) expect(outcomeOf(effect)).toBe("ok");
  });
});

describe("createGame: a card's trigger steps hold values the engine knows", () => {
  const pickCard: Step = { op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "c" };
  it.each([
    ["an unknown hook", trigger({ hook: "coupResolved" })],
    ["an empty do", trigger({}, [])],
    ["a missing do", trigger({ do: undefined })],
    ["an unknown duration", trigger({ duration: { kind: "gameEnd" } })],
    ["a missing duration", trigger({ duration: undefined })],
    ["a card choice in its do", trigger({}, [pickCard])],
    ["an addToNumber of 0 in its do", trigger({}, [{ op: "addToNumber", var: "n", amount: 0 }])],
  ])("returns invalidRuleset for a trigger with %s, at the top and nested", (_what, step) => {
    for (const effect of nested(step)) expect(outcomeOf(effect)).toBe("invalidRuleset");
  });
  it("accepts good triggers at any depth: each hook, holding a yes/no, a modifier or another trigger", () => {
    const opsMod: Step = {
      op: "modifier",
      mod: { hook: "opsValue", side: "both", add: 1 },
      duration: { kind: "turnEnd" },
    };
    const steps = [
      trigger(),
      trigger({ hook: "cardPlayed" }, [choose("ok"), ifYes("ok", [{ op: "marker", label: "y" }])]),
      trigger({}, [opsMod]),
      trigger({}, [trigger({ hook: "cardPlayed" })]),
    ];
    for (const step of steps) for (const effect of nested(step)) expect(outcomeOf(effect)).toBe("ok");
  });
});
