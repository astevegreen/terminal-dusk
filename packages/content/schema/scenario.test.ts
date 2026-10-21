import { describe, expect, it } from "vitest";
import { scenarioSchema } from "./scenario.ts";

const base = { id: "s1", name: "Test", turns: 4, playsPerTurn: 2, handSize: 3 };
const eras = [
  { era: "mid", turn: 2, cards: ["a", "b"] },
  { era: "late", turn: 3, cards: ["c"] },
];
/** The paths of every problem the schema finds in `data`. */
const paths = (data: unknown): unknown[][] => {
  const r = scenarioSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};

describe("scenario schema", () => {
  it("accepts a full valid scenario", () => {
    const full = { ...base, eras, contingency: { lio: [1, 2, 3], sae: [4, 4, 5] } };
    expect(scenarioSchema.safeParse(full).success).toBe(true);
  });
  it("accepts a scenario with no eras and no contingency", () => {
    expect(scenarioSchema.safeParse(base).success).toBe(true);
  });
  it("accepts eras: []", () => {
    expect(scenarioSchema.safeParse({ ...base, eras: [] }).success).toBe(true);
  });
  it("accepts a contingency naming only one side", () => {
    expect(scenarioSchema.safeParse({ ...base, contingency: { sae: [1, 2, 3] } }).success).toBe(true);
  });
  it("refuses other fields", () => {
    expect(paths({ ...base, map: "x" })).toEqual([[]]);
  });
  it("refuses empty id and name, and turns or playsPerTurn that are not whole numbers of 1 or more", () => {
    expect(paths({ ...base, id: "" })).toEqual([["id"]]);
    expect(paths({ ...base, name: "" })).toEqual([["name"]]);
    expect(paths({ ...base, turns: 0 })).toEqual([["turns"]]);
    expect(paths({ ...base, turns: 2.5 })).toEqual([["turns"]]);
    expect(paths({ ...base, playsPerTurn: 0 })).toEqual([["playsPerTurn"]]);
  });
  it("refuses a scenario with no hand size, or one that is not a whole number of 1 or more", () => {
    const noHandSize: Partial<typeof base> = { ...base };
    delete noHandSize.handSize;
    expect(paths(noHandSize)).toEqual([["handSize"]]);
    expect(paths({ ...base, handSize: 0 })).toEqual([["handSize"]]);
    expect(paths({ ...base, handSize: 3.5 })).toEqual([["handSize"]]);
  });
  it("refuses a hand size below 1 + plays per turn, at handSize, and accepts it at exactly that", () => {
    expect(paths({ ...base, handSize: 2 })).toEqual([["handSize"]]);
    expect(paths({ ...base, handSize: 3 })).toEqual([]);
    expect(paths({ ...base, playsPerTurn: 1, handSize: 2 })).toEqual([]);
  });
  it("refuses eras, contingency, lio and sae written as undefined", () => {
    expect(paths({ ...base, eras: undefined })).toEqual([["eras"]]);
    expect(paths({ ...base, contingency: undefined })).toEqual([["contingency"]]);
    expect(paths({ ...base, contingency: { lio: undefined } })).toEqual([["contingency", "lio"]]);
    expect(paths({ ...base, contingency: { sae: undefined } })).toEqual([["contingency", "sae"]]);
  });
  it("refuses an era turn that is not a whole number from 2 to turns", () => {
    for (const turn of [1, 5, 2.5]) {
      expect(paths({ ...base, eras: [{ era: "m", turn, cards: ["a"] }] })).toEqual([["eras", 0, "turn"]]);
    }
  });
  it("refuses two eras on the same turn, at the second", () => {
    const twice = [eras[0], { era: "late", turn: 2, cards: ["c"] }];
    expect(paths({ ...base, eras: twice })).toEqual([["eras", 1, "turn"]]);
  });
  it("refuses an era with an empty name, at its era", () => {
    expect(paths({ ...base, eras: [{ era: "", turn: 2, cards: ["a"] }] })).toEqual([["eras", 0, "era"]]);
  });
  it("refuses an era with no cards, at its cards", () => {
    expect(paths({ ...base, eras: [{ era: "m", turn: 2, cards: [] }] })).toEqual([["eras", 0, "cards"]]);
  });
  it("refuses an empty card id, at that card", () => {
    expect(paths({ ...base, eras: [{ era: "m", turn: 2, cards: ["a", ""] }] })).toEqual([["eras", 0, "cards", 1]]);
  });
  it("refuses a card listed twice within one era, at the second listing", () => {
    const twice = [{ era: "m", turn: 2, cards: ["a", "b", "a"] }];
    expect(paths({ ...base, eras: twice })).toEqual([["eras", 0, "cards", 2]]);
  });
  it("refuses a card listed twice across two eras, at the second listing", () => {
    const across = [eras[0], { era: "late", turn: 3, cards: ["c", "b"] }];
    expect(paths({ ...base, eras: across })).toEqual([["eras", 1, "cards", 1]]);
  });
  it("refuses a Contingency list with fewer than 3 cards, at the list", () => {
    expect(paths({ ...base, contingency: { lio: [1, 2] } })).toEqual([["contingency", "lio"]]);
    expect(paths({ ...base, contingency: { sae: [4, 4] } })).toEqual([["contingency", "sae"]]);
    expect(paths({ ...base, contingency: { lio: [1] } })).toEqual([["contingency", "lio"]]);
    expect(paths({ ...base, contingency: { sae: [] } })).toEqual([["contingency", "sae"]]);
  });
  it("refuses a Contingency number that is not a whole number, 1 or more, at that number", () => {
    expect(paths({ ...base, contingency: { lio: [1, 0, 3] } })).toEqual([["contingency", "lio", 1]]);
    expect(paths({ ...base, contingency: { sae: [1, 2, 1.5] } })).toEqual([["contingency", "sae", 2]]);
  });
});
