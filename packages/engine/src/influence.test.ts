// R15: who controls a country, what one influence costs to place, and adding and removing influence
// (docs/design/map-and-points.md, "Influence"). Built on the engine test map (test/map.ts).
import { describe, expect, it } from "vitest";
import { addInfluence, removeInfluence } from "./influence.ts";
import { controller, createGame, placementCost } from "./index.ts";
import type { CountryId, GameState, PublicState, Side } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeSetup, ruleset } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";

const build = (setup = mapSetup()): GameState => {
  const r = createGame(ruleset, setup, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
};

/** The test map's public state with every country's influence set from `counts` (0 where none is given). */
const withInfluence = (counts: Record<CountryId, { lio?: number; sae?: number }>): PublicState => {
  const pub = build().public;
  return {
    ...pub,
    influence: pub.influence!.map(({ country }) => ({
      country,
      lio: counts[country]?.lio ?? 0,
      sae: counts[country]?.sae ?? 0,
    })),
  };
};

const countOf = (state: GameState, country: CountryId, side: Side): number =>
  state.public.influence!.find((e) => e.country === country)![side];

describe("controller", () => {
  // Charlie has stability 3.
  it("controls with exactly the stability while the rival has 0", () => {
    expect(controller(withInfluence({ charlie: { lio: 3 } }), "charlie")).toBe("lio");
  });
  it("does not control one short of the stability", () => {
    expect(controller(withInfluence({ charlie: { lio: 2 } }), "charlie")).toBeNull();
  });
  it("controls with exactly the rival's influence plus the stability", () => {
    expect(controller(withInfluence({ charlie: { lio: 2, sae: 5 } }), "charlie")).toBe("sae");
  });
  it("does not control one short of the rival's influence plus the stability", () => {
    expect(controller(withInfluence({ charlie: { lio: 2, sae: 4 } }), "charlie")).toBeNull();
  });
  it("nobody controls a country where both sides have 0", () => {
    expect(controller(withInfluence({}), "charlie")).toBeNull();
  });
});

describe("placementCost", () => {
  it("is allowed where the side already has influence", () => {
    // Bravo touches neither home box; LIO has 1 there.
    expect(placementCost(withInfluence({ bravo: { lio: 1 } }), "lio", "bravo")).toBe(1);
  });
  it("is allowed in a country next to one where the side has influence", () => {
    // Delta is next to charlie.
    expect(placementCost(withInfluence({ charlie: { lio: 1 } }), "lio", "delta")).toBe(1);
  });
  it("is allowed in a country next to the side's home box", () => {
    expect(placementCost(withInfluence({}), "lio", "alpha")).toBe(1);
    expect(placementCost(withInfluence({}), "sae", "delta")).toBe(1);
  });
  it("is null in a country that is none of them", () => {
    expect(placementCost(withInfluence({ echo: { lio: 1 } }), "lio", "bravo")).toBeNull();
  });
  it("the rival's home-box neighbour does not count for the other side", () => {
    expect(placementCost(withInfluence({}), "lio", "echo")).toBeNull();
    expect(placementCost(withInfluence({}), "sae", "alpha")).toBeNull();
  });
  it("costs 2 while the rival controls the country and 1 once that control is broken", () => {
    // Alpha has stability 2. SAE controls it with 2 against LIO's 0.
    expect(placementCost(withInfluence({ alpha: { sae: 2 } }), "lio", "alpha")).toBe(2);
    expect(placementCost(withInfluence({ alpha: { sae: 2, lio: 1 } }), "lio", "alpha")).toBe(1);
    expect(placementCost(withInfluence({ alpha: { sae: 3, lio: 1 } }), "lio", "alpha")).toBe(2);
  });
  it("costs 1 in a country the side itself controls", () => {
    expect(placementCost(withInfluence({ alpha: { lio: 5 } }), "lio", "alpha")).toBe(1);
  });
});

describe("addInfluence and removeInfluence", () => {
  it("addInfluence raises only that side's count in that country by n", () => {
    const s = build();
    const after = addInfluence(s, "sae", "charlie", 2);
    expect(after.public.influence).toStrictEqual(
      s.public.influence!.map((e) => (e.country === "charlie" ? { ...e, sae: e.sae + 2 } : e)),
    );
    expect({ ...after, public: { ...after.public, influence: s.public.influence } }).toStrictEqual(s);
  });
  it("removeInfluence lowers that side's count by n", () => {
    const after = removeInfluence(build(), "lio", "alpha", 1);
    expect(countOf(after, "alpha", "lio")).toBe(1);
    expect(countOf(after, "alpha", "sae")).toBe(0);
    expect(countOf(after, "charlie", "lio")).toBe(1);
  });
  it("removeInfluence stops at 0, never below", () => {
    expect(countOf(removeInfluence(build(), "lio", "alpha", 2), "alpha", "lio")).toBe(0);
    expect(countOf(removeInfluence(build(), "lio", "alpha", 9), "alpha", "lio")).toBe(0);
    expect(countOf(removeInfluence(build(), "lio", "bravo", 1), "bravo", "lio")).toBe(0);
  });
  it("adding or removing 0 leaves the counts as they were", () => {
    const s = build();
    expect(addInfluence(s, "lio", "alpha", 0).public.influence).toStrictEqual(s.public.influence);
    expect(removeInfluence(s, "lio", "alpha", 0).public.influence).toStrictEqual(s.public.influence);
  });
  it("both return a new state and never mutate their input (frozen input)", () => {
    const s = deepFreeze(build());
    const before = JSON.stringify(s);
    const added = addInfluence(s, "lio", "bravo", 3);
    const removed = removeInfluence(s, "sae", "echo", 1);
    expect(JSON.stringify(s)).toBe(before);
    expect(added).not.toBe(s);
    expect(removed).not.toBe(s);
    expect(countOf(added, "bravo", "lio")).toBe(3);
    expect(countOf(removed, "echo", "sae")).toBe(2);
  });
});

describe("no map, an unknown country, or a bad n", () => {
  const noMap = build(makeSetup());
  it("controller and placementCost give null when the game has no map", () => {
    expect(() => controller(noMap.public, "alpha")).not.toThrow();
    expect(controller(noMap.public, "alpha")).toBeNull();
    expect(placementCost(noMap.public, "lio", "alpha")).toBeNull();
  });
  it("controller and placementCost give null for an unknown country id, a home box included", () => {
    const pub = withInfluence({ alpha: { lio: 5 } });
    for (const id of ["nowhere", "lio", "sae", ""]) {
      expect(controller(pub, id)).toBeNull();
      expect(placementCost(pub, "lio", id)).toBeNull();
    }
  });
  it("addInfluence and removeInfluence return the state unchanged when the game has no map", () => {
    expect(addInfluence(noMap, "lio", "alpha", 1)).toBe(noMap);
    expect(removeInfluence(noMap, "lio", "alpha", 1)).toBe(noMap);
  });
  it("addInfluence and removeInfluence return the state unchanged for an unknown country id", () => {
    const s = build();
    expect(addInfluence(s, "lio", "nowhere", 1)).toBe(s);
    expect(removeInfluence(s, "lio", "nowhere", 1)).toBe(s);
  });
  it("addInfluence and removeInfluence return the state unchanged for an n that is not a whole number 0 or more", () => {
    const s = build();
    for (const n of [-1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(addInfluence(s, "lio", "alpha", n)).toBe(s);
      expect(removeInfluence(s, "lio", "alpha", n)).toBe(s);
    }
  });
  it("a map country missing from the influence list is treated as unknown, without throwing", () => {
    const s = build();
    const partial: GameState = { ...s, public: { ...s.public, influence: s.public.influence!.slice(1) } };
    expect(controller(partial.public, "alpha")).toBeNull();
    expect(addInfluence(partial, "lio", "alpha", 1)).toBe(partial);
    expect(testMap().countries[0]!.id).toBe("alpha");
  });
});
