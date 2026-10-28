// A game started with a map keeps it, and every country's influence, in the public compartment only.
import { describe, expect, it } from "vitest";
import { createGame, hiddenPart, reconstruct, SIDES, viewFor } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeSetup, ruleset } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import { byCodeUnit } from "./test/sort.ts";

const build = (setup: Setup): GameState => {
  const r = createGame(ruleset, setup, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
};

describe("createGame with a map", () => {
  it("a setup without a map has neither map nor influence in state", () => {
    const s = build(makeSetup());
    expect("map" in s.public).toBe(false);
    expect("influence" in s.public).toBe(false);
  });
  it("state.public.map holds the regions, closing order, countries, battleground lists and home-box neighbours, but not the starting influence", () => {
    const { startingInfluence, ...fixed } = testMap();
    expect(startingInfluence.length).toBeGreaterThan(0);
    const s = build(mapSetup());
    expect(s.public.map).toStrictEqual(fixed);
    expect(Object.keys(s.public.map!).toSorted(byCodeUnit)).toEqual([
      "battlegrounds",
      "closingOrder",
      "countries",
      "homeBox",
      "regions",
    ]);
  });
  it("state.public.influence has one entry per country in the map's order, starting at the setup's influence (0 where none is given)", () => {
    expect(build(mapSetup()).public.influence).toStrictEqual([
      { country: "alpha", lio: 2, sae: 0 },
      { country: "bravo", lio: 0, sae: 0 },
      { country: "charlie", lio: 1, sae: 1 },
      { country: "delta", lio: 0, sae: 0 },
      { country: "echo", lio: 0, sae: 3 },
      { country: "foxtrot", lio: 0, sae: 0 },
    ]);
  });
  it("the influence counts are plain JSON whole numbers", () => {
    const influence = build(mapSetup()).public.influence!;
    expect(JSON.parse(JSON.stringify(influence))).toStrictEqual(influence);
    for (const e of influence) for (const side of SIDES) expect(Number.isInteger(e[side])).toBe(true);
  });
  it("nothing about the map is in private or secret", () => {
    const s = build(mapSetup());
    const hidden = JSON.stringify({ private: s.private, secret: s.secret });
    const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "north", "south", "east"];
    for (const word of [...words, "homeBox", "closingOrder", "battlegrounds", "influence"]) {
      expect(hidden).not.toContain(word);
    }
  });
  it("viewFor shows the same map and influence to LIO, SAE and spectators, and reconstruct gives back the state", () => {
    const s = build(mapSetup());
    for (const viewer of [...SIDES, "spectator"] as const) {
      const view = viewFor(s, viewer);
      expect(view.public.map).toStrictEqual(s.public.map);
      expect(view.public.influence).toStrictEqual(s.public.influence);
    }
    for (const side of SIDES) expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toStrictEqual(s);
  });
  it("createGame does not mutate the setup it is given (frozen input)", () => {
    const setup = deepFreeze(mapSetup());
    expect(() => build(setup)).not.toThrow();
    expect(setup.map).toStrictEqual(testMap());
  });
  it("the state shares no arrays or objects with the setup: changing setup.map afterwards leaves the state as it was", () => {
    const setup = mapSetup();
    const s = build(setup);
    const before = JSON.stringify(s);
    const map = setup.map!;
    map.regions[0]!.name = "Changed";
    map.regions.push({ id: "x", name: "X" });
    map.countries[0]!.neighbours.push("echo");
    map.countries[0]!.stability = 9;
    map.countries.pop();
    map.homeBox.lio.push("bravo");
    map.startingInfluence[0]!.lio = 7;
    map.startingInfluence.push({ country: "bravo", lio: 4, sae: 4 });
    expect(JSON.stringify(s)).toBe(before);
  });
});
