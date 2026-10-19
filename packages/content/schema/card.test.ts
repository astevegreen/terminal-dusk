import { createGame, seedHash } from "@terminal-dusk/engine";
import type { CardDef, Ruleset, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { cardSchema } from "./card.ts";
import { drawFor, issuesOf, lioCard, pathsOf, pickCard, validCard, yesNo } from "./test/cards.ts";

describe("card schema: accepted cards", () => {
  it("accepts a card with every field", () => {
    expect(issuesOf(validCard())).toEqual([]);
  });

  it("accepts a card whose effect is empty", () => {
    expect(issuesOf({ ...validCard(), effect: [] })).toEqual([]);
  });

  it("accepts every kind of step a card may hold, a forEach inside an if", () => {
    const effect = [
      yesNo,
      {
        op: "if",
        cond: { op: "yes", var: "agreed" },
        then: [{ op: "forEach", over: ["a", "b"], bind: "item", do: [{ op: "marker", label: "item", var: "item" }] }],
        else: [{ op: "spendPoints", side: "sae", amount: 0 }],
      },
      drawFor,
    ];
    expect(issuesOf({ ...lioCard(), effect })).toEqual([]);
  });

  it("accepts a contingency draw for one side, with or without a variable for the number", () => {
    expect(issuesOf({ ...lioCard(), effect: [drawFor, { op: "drawContingency", side: "lio" }] })).toEqual([]);
    const saeCard = { ...validCard(), affiliation: "sae" };
    expect(
      issuesOf({
        ...saeCard,
        effect: [
          { ...drawFor, side: "sae" },
          { op: "drawContingency", side: "sae" },
        ],
      }),
    ).toEqual([]);
  });

  it("accepts text variants for two platforms", () => {
    const variants = { steam: { name: "Steam name" }, ios: { rules: "Shorter rules.", art: "art/test-card-ios" } };
    expect(issuesOf({ ...validCard(), text: { ...validCard().text, variants } })).toEqual([]);
  });
});

describe("card schema: rejected fields", () => {
  it.each(["id", "era", "ops", "affiliation", "effect", "text"])("rejects a card missing its %s", (field) => {
    const card: Record<string, unknown> = validCard();
    delete card[field];
    expect(pathsOf(card)).toEqual([[field]]);
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["a string", "2"],
  ])("rejects ops that are %s, pointing at ops", (_, ops) => {
    expect(pathsOf({ ...validCard(), ops })).toEqual([["ops"]]);
  });

  it("rejects an affiliation that is not lio, sae or neutral", () => {
    expect(pathsOf({ ...validCard(), affiliation: "both" })).toEqual([["affiliation"]]);
  });

  it("rejects an empty name, pointing at text.name", () => {
    expect(pathsOf({ ...validCard(), text: { ...validCard().text, name: "" } })).toEqual([["text", "name"]]);
  });

  it("rejects a text variant for an unknown platform, naming it", () => {
    const variants = { xbox: { name: "Xbox name" } };
    const issues = issuesOf({ ...validCard(), text: { ...validCard().text, variants } });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["text", "variants"], expect.stringContaining("xbox")],
    ]);
  });

  it("rejects a text variant that changes nothing", () => {
    const variants = { web: {} };
    expect(pathsOf({ ...validCard(), text: { ...validCard().text, variants } })).toEqual([["text", "variants", "web"]]);
  });
});

describe("card schema: rejected unknown fields", () => {
  it("rejects an unknown field at the top level, such as flags before their rules exist", () => {
    const issues = issuesOf({ ...validCard(), flags: { scoring: true } });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([[[], expect.stringContaining("flags")]]);
  });

  it("rejects an unknown field in text", () => {
    const issues = issuesOf({ ...validCard(), text: { ...validCard().text, flavour: "Extra." } });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["text"], expect.stringContaining("flavour")],
    ]);
  });

  it("rejects an unknown field in a step", () => {
    const issues = issuesOf({ ...validCard(), effect: [{ op: "marker", label: "ran", colour: "red" }] });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["effect", 0], expect.stringContaining("colour")],
    ]);
  });

  it("rejects an unknown field in a contingency draw", () => {
    const issues = issuesOf({ ...lioCard(), effect: [{ ...drawFor, modifier: 1 }] });
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["effect", 0], expect.stringContaining("modifier")],
    ]);
  });

  it("rejects a contingency draw for both sides, or with no side, pointing at side", () => {
    expect(pathsOf({ ...lioCard(), effect: [{ ...drawFor, side: "both" }] })).toEqual([["effect", 0, "side"]]);
    expect(pathsOf({ ...lioCard(), effect: [{ op: "drawContingency" }] })).toEqual([["effect", 0, "side"]]);
  });

  it("rejects a contingency draw whose variable name is empty", () => {
    expect(pathsOf({ ...lioCard(), effect: [{ ...drawFor, bind: "" }] })).toEqual([["effect", 0, "bind"]]);
  });

  it("rejects a step with an unknown op", () => {
    expect(pathsOf({ ...validCard(), effect: [{ op: "drawCard" }] })).toEqual([["effect", 0, "op"]]);
  });
});

describe("card schema: a side's card draws only from its own deck, a neutral card from the player's", () => {
  const drawOf = (side: string) => ({ op: "drawContingency", side });
  const placements = (step: unknown): [string, unknown[], (string | number)[]][] => [
    ["at the top", [step], ["effect", 0, "side"]],
    [
      "inside an if's then",
      [{ op: "if", cond: { op: "yes", var: "a" }, then: [step] }],
      ["effect", 0, "then", 0, "side"],
    ],
    [
      "inside an if's else",
      [{ op: "if", cond: { op: "yes", var: "a" }, then: [], else: [step] }],
      ["effect", 0, "else", 0, "side"],
    ],
    ["inside a forEach", [{ op: "forEach", over: ["a"], bind: "x", do: [step] }], ["effect", 0, "do", 0, "side"]],
    [
      "inside a trigger's reaction",
      [{ op: "trigger", hook: "turnEnd", do: [step], duration: { kind: "turnEnd" } }],
      ["effect", 0, "do", 0, "side"],
    ],
  ];

  it.each([
    ["lio", "sae"],
    ["sae", "lio"],
  ])("rejects a %s card drawing from %s's deck, pointing at the step's side", (own, other) => {
    for (const [, effect, path] of placements(drawOf(other))) {
      const issues = issuesOf({ ...validCard(), affiliation: own, effect });
      const names = { lio: "LIO", sae: "SAE" } as const;
      const message = `This is an ${names[own as "lio" | "sae"]} card, so its event can only draw from ${names[own as "lio" | "sae"]}'s Contingency deck, not ${names[other as "lio" | "sae"]}'s.`;
      expect(issues.map((issue) => [issue.path, issue.message])).toEqual([[path, message]]);
    }
  });

  it.each(["lio", "sae"])(
    "rejects a neutral card drawing from %s's deck, saying it draws from the player's deck",
    (side) => {
      const names = { lio: "LIO", sae: "SAE" } as const;
      const message = `This is a neutral card, so its event can only draw from the deck of the side that played it ("side": "player"), not ${names[side as "lio" | "sae"]}'s.`;
      for (const [, effect, path] of placements(drawOf(side))) {
        const issues = issuesOf({ ...validCard(), effect });
        expect(issues.map((issue) => [issue.path, issue.message])).toEqual([[path, message]]);
      }
    },
  );

  it("accepts a neutral card drawing from the deck of the side that played it, at any depth", () => {
    for (const [, effect] of placements(drawOf("player"))) {
      expect(issuesOf({ ...validCard(), effect })).toEqual([]);
    }
  });

  it.each([
    ["lio", "LIO"],
    ["sae", "SAE"],
  ])("rejects a %s card drawing from the deck of the side that played it, pointing at the step's side", (own, name) => {
    const message = `This is an ${name} card, so its event can only draw from ${name}'s Contingency deck, not the deck of the side that played it ("player").`;
    for (const [, effect, path] of placements(drawOf("player"))) {
      const issues = issuesOf({ ...validCard(), affiliation: own, effect });
      expect(issues.map((issue) => [issue.path, issue.message])).toEqual([[path, message]]);
    }
  });

  it.each(["lio", "sae"])("accepts a %s card drawing from its own deck, at any depth", (side) => {
    for (const [, effect] of placements(drawOf(side))) {
      expect(issuesOf({ ...validCard(), affiliation: side, effect })).toEqual([]);
    }
  });
});

describe("card schema: steps at any depth", () => {
  it("rejects a card choice in a card's effect", () => {
    expect(pathsOf({ ...validCard(), effect: [pickCard] })).toEqual([["effect", 0, "decision", "kind"]]);
  });

  it("rejects a card choice nested in an if", () => {
    const effect = [{ op: "if", cond: { op: "yes", var: "agreed" }, then: [], else: [pickCard] }];
    expect(pathsOf({ ...validCard(), effect })).toEqual([["effect", 0, "else", 0, "decision", "kind"]]);
  });

  it("rejects a card choice nested in a forEach", () => {
    const effect = [{ op: "forEach", over: ["a"], bind: "item", do: [pickCard] }];
    expect(pathsOf({ ...validCard(), effect })).toEqual([["effect", 0, "do", 0, "decision", "kind"]]);
  });

  it("points at a bad step nested two blocks deep", () => {
    const spend = { op: "spendPoints", side: "lio", amount: -1 };
    const effect = [
      yesNo,
      {
        op: "if",
        cond: { op: "yes", var: "agreed" },
        then: [{ op: "forEach", over: ["a"], bind: "item", do: [spend] }],
      },
    ];
    expect(pathsOf({ ...validCard(), effect })).toEqual([["effect", 1, "then", 0, "do", 0, "amount"]]);
  });
});

describe("card schema and the engine", () => {
  it("gives a card the engine accepts: a game using it starts without an invalidRuleset error", () => {
    const parsed = cardSchema.parse({ ...validCard(), effect: [yesNo] });
    // One turn of an opening card and one play needs two non-neutral cards in each hand.
    const sideCard = (id: string, affiliation: "lio" | "sae"): CardDef => ({
      id,
      era: "early",
      ops: 1,
      affiliation,
      effect: [],
    });
    const ruleset: Ruleset = {
      id: "schema-test",
      cards: [parsed, sideCard("l1", "lio"), sideCard("l2", "lio"), sideCard("s1", "sae"), sideCard("s2", "sae")],
    };
    const setup: Setup = {
      seedHash: seedHash("seed"),
      hands: { lio: ["l1", "l2", "test-card"], sae: ["s1", "s2"] },
      deck: [],
      turns: 1,
      playsPerTurn: 1,
      contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
    };
    const result = createGame(ruleset, setup, "seed");
    expect(result.ok ? null : result.error).toBeNull();
  });
});

describe("card schema: number tests and addToNumber", () => {
  const withEffect = (effect: unknown[]) => ({ ...lioCard(), effect });
  const test = (op: string, value: unknown) => ({ op: "if", cond: { op, var: "drawn", value }, then: [] });
  const add = (amount: unknown) => ({ op: "addToNumber", var: "drawn", amount });

  it("accepts the three number tests and addToNumber, at any depth", () => {
    const inner = [add(1), add(-2), test("atLeast", 4), test("atMost", 0), test("equals", -1)];
    expect(issuesOf(withEffect([drawFor, { op: "forEach", over: ["a"], bind: "x", do: inner }]))).toEqual([]);
  });

  it("refuses a number test with a missing or non-integer value", () => {
    expect(issuesOf(withEffect([test("atLeast", undefined)])).length).toBeGreaterThan(0);
    expect(issuesOf(withEffect([test("equals", 1.5)])).length).toBeGreaterThan(0);
  });

  it("refuses an addToNumber amount of 0 or a non-integer", () => {
    expect(issuesOf(withEffect([add(0)])).length).toBeGreaterThan(0);
    expect(issuesOf(withEffect([add(0.5)])).length).toBeGreaterThan(0);
    expect(issuesOf(withEffect([add(undefined)])).length).toBeGreaterThan(0);
  });

  it("refuses an unknown condition op", () => {
    expect(issuesOf(withEffect([test("greaterThan", 1)])).length).toBeGreaterThan(0);
  });
});
