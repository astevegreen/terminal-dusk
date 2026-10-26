import { describe, expect, it } from "vitest";
import raw from "../scenarios/test-map.json" with { type: "json" };
import { mapSchema } from "./map.ts";
import { scenarioSchema } from "./scenario.ts";

/** A small valid map: three regions, three countries in a line, x-y-z, and v on its own; closing order r2, r3, r1. */
const validMap = () => ({
  regions: [
    { id: "r1", name: "Region 1" },
    { id: "r2", name: "Region 2" },
    { id: "r3", name: "Region 3" },
  ],
  closingOrder: ["r2", "r3", "r1"],
  countries: [
    { id: "x", name: "X", region: "r1", stability: 1, battleground: true, neighbours: ["y"] },
    { id: "y", name: "Y", region: "r1", stability: 2, battleground: false, neighbours: ["x", "z"] },
    { id: "z", name: "Z", region: "r2", stability: 3, battleground: true, neighbours: ["y"] },
    { id: "v", name: "V", region: "r3", stability: 1, battleground: false, neighbours: [] as string[] },
  ],
  homeBox: { lio: ["x"], sae: ["z", "y"] },
  startingInfluence: [
    { country: "x", lio: 2, sae: 0 },
    { country: "z", lio: 0, sae: 1 },
  ],
});
type MapData = ReturnType<typeof validMap>;

/** The paths of every problem the map schema finds after `change` edits a fresh valid map. */
const paths = (change: (m: MapData) => void): unknown[][] => {
  const m = validMap();
  change(m);
  const r = mapSchema.safeParse(m);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};
const base = { id: "s1", name: "Test", turns: 4, playsPerTurn: 2, handSize: 3 };

describe("map schema", () => {
  it("accepts a valid map, and a scenario carrying it", () => {
    expect(paths(() => {})).toEqual([]);
    expect(scenarioSchema.safeParse({ ...base, map: validMap() }).success).toBe(true);
  });
  it("refuses a scenario map with a problem, at its path under map", () => {
    const m = validMap();
    m.countries[0]!.stability = 0;
    const r = scenarioSchema.safeParse({ ...base, map: m });
    expect(r.success ? [] : r.error.issues.map((i) => [...i.path])).toEqual([["map", "countries", 0, "stability"]]);
  });
  it("refuses a map written as undefined", () => {
    const r = scenarioSchema.safeParse({ ...base, map: undefined });
    expect(r.success ? [] : r.error.issues.map((i) => [...i.path])).toEqual([["map"]]);
  });
  it("refuses a map with no regions", () => {
    expect(paths((m) => (m.regions = []))).toEqual([["regions"]]);
  });
  it("refuses a map with no countries", () => {
    expect(paths((m) => (m.countries = []))).toEqual([["countries"]]);
  });
  it("refuses an empty region id", () => {
    expect(paths((m) => m.regions.push({ id: "", name: "Region 4" }))).toEqual([["regions", 3, "id"]]);
  });
  it("refuses an empty region name", () => {
    expect(paths((m) => (m.regions[0]!.name = ""))).toEqual([["regions", 0, "name"]]);
  });
  it("refuses an empty country id", () => {
    const blank = { id: "", name: "W", region: "r1", stability: 1, battleground: false, neighbours: [] };
    expect(paths((m) => m.countries.push(blank))).toEqual([["countries", 4, "id"]]);
  });
  it("refuses an empty country name", () => {
    expect(paths((m) => (m.countries[1]!.name = ""))).toEqual([["countries", 1, "name"]]);
  });
  it("refuses duplicate region ids, at the second", () => {
    expect(paths((m) => m.regions.push({ id: "r1", name: "Again" }))).toEqual([["regions", 3, "id"]]);
  });
  it("refuses duplicate country ids, at the second", () => {
    expect(paths((m) => m.countries.push({ ...m.countries[0]!, neighbours: [] }))).toEqual([["countries", 4, "id"]]);
  });
  it("refuses a country in an unknown region", () => {
    expect(paths((m) => (m.countries[1]!.region = "r9"))).toEqual([["countries", 1, "region"]]);
  });
  it("refuses an unknown neighbour", () => {
    expect(paths((m) => m.countries[0]!.neighbours.push("w"))).toEqual([["countries", 0, "neighbours", 1]]);
  });
  it("refuses a country that lists itself as a neighbour", () => {
    expect(paths((m) => m.countries[0]!.neighbours.push("x"))).toEqual([["countries", 0, "neighbours", 1]]);
  });
  it("refuses a neighbour listed twice, at the second", () => {
    expect(paths((m) => m.countries[0]!.neighbours.push("y"))).toEqual([["countries", 0, "neighbours", 1]]);
  });
  it("refuses one-way adjacency, at the listing with no listing back", () => {
    expect(paths((m) => (m.countries[2]!.neighbours = []))).toEqual([["countries", 1, "neighbours", 1]]);
  });
  it("refuses an unknown home-box country", () => {
    expect(paths((m) => m.homeBox.lio.push("w"))).toEqual([["homeBox", "lio", 1]]);
  });
  it("refuses a country named twice in a side's home-box list, at the second", () => {
    expect(paths((m) => m.homeBox.sae.push("z"))).toEqual([["homeBox", "sae", 2]]);
  });
  it("accepts a country next to both home boxes", () => {
    expect(paths((m) => m.homeBox.lio.push("y"))).toEqual([]);
  });
  it("refuses a stability that is not a whole number 1 or more", () => {
    expect(paths((m) => (m.countries[0]!.stability = 0))).toEqual([["countries", 0, "stability"]]);
    expect(paths((m) => (m.countries[0]!.stability = 1.5))).toEqual([["countries", 0, "stability"]]);
  });
  it("refuses a region with no country", () => {
    expect(paths((m) => m.regions.push({ id: "r4", name: "Region 4" }))).toEqual([["regions", 3]]);
  });
  it("refuses a map with no closingOrder", () => {
    expect(paths((m) => delete (m as { closingOrder?: string[] }).closingOrder)).toEqual([["closingOrder"]]);
  });
  it("refuses a closingOrder with fewer than 3 region ids", () => {
    expect(paths((m) => m.closingOrder.pop())).toEqual([["closingOrder"]]);
  });
  it("refuses a closingOrder with more than 3 region ids", () => {
    const fourth = (m: MapData) => {
      m.regions.push({ id: "r4", name: "Region 4" });
      m.countries.push({ id: "w", name: "W", region: "r4", stability: 1, battleground: false, neighbours: [] });
      m.closingOrder.push("r4");
    };
    expect(paths(fourth)).toEqual([["closingOrder"]]);
  });
  it("refuses a closingOrder naming an unknown region", () => {
    expect(paths((m) => (m.closingOrder[1] = "r9"))).toEqual([["closingOrder", 1]]);
  });
  it("refuses a closingOrder naming a region twice, at the second", () => {
    expect(paths((m) => (m.closingOrder[2] = "r2"))).toEqual([["closingOrder", 2]]);
  });
  it("refuses starting influence that names an unknown country", () => {
    expect(paths((m) => (m.startingInfluence[1]!.country = "w"))).toEqual([["startingInfluence", 1, "country"]]);
  });
  it("refuses starting influence that repeats a country, at the second", () => {
    const again = { country: "x", lio: 1, sae: 1 };
    expect(paths((m) => m.startingInfluence.push(again))).toEqual([["startingInfluence", 2, "country"]]);
  });
  it("refuses a negative starting-influence amount", () => {
    expect(paths((m) => (m.startingInfluence[0]!.sae = -1))).toEqual([["startingInfluence", 0, "sae"]]);
  });
  it("refuses a fractional starting-influence amount", () => {
    expect(paths((m) => (m.startingInfluence[0]!.lio = 1.5))).toEqual([["startingInfluence", 0, "lio"]]);
  });
  it("refuses other fields in the map, a region, a country, the home box or an influence entry", () => {
    const extra = (data: unknown) => {
      const r = mapSchema.safeParse(data);
      return r.success ? [] : r.error.issues.map((i) => [...i.path]);
    };
    const m = validMap();
    expect(extra({ ...m, size: 1 })).toEqual([[]]);
    expect(extra({ ...m, regions: [{ ...m.regions[0], x: 1 }, ...m.regions.slice(1)] })).toEqual([["regions", 0]]);
    expect(extra({ ...m, countries: [{ ...m.countries[0], x: 1 }, ...m.countries.slice(1)] })).toEqual([
      ["countries", 0],
    ]);
    expect(extra({ ...m, homeBox: { ...m.homeBox, world: [] } })).toEqual([["homeBox"]]);
    expect(extra({ ...m, startingInfluence: [{ ...m.startingInfluence[0], x: 1 }] })).toEqual([
      ["startingInfluence", 0],
    ]);
  });
  it("refuses a copy of the test map with one-way adjacency", () => {
    const copy = JSON.parse(JSON.stringify(raw)) as { map: MapData };
    const first = copy.map.countries[0]!;
    const other = copy.map.countries.find((c) => c.id === first.neighbours[0])!;
    other.neighbours = other.neighbours.filter((n) => n !== first.id);
    expect(scenarioSchema.safeParse(raw).success).toBe(true);
    const r = scenarioSchema.safeParse(copy);
    expect(r.success ? [] : r.error.issues.map((i) => [...i.path])).toEqual([["map", "countries", 0, "neighbours", 0]]);
  });
});
