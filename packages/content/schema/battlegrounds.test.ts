// Battlegrounds by era in a scenario (#429): the map holds one list per era, matched by name, and the scenario names
// its first era. Each problem is reported at its path.
import { describe, expect, it } from "vitest";
import raw from "../scenarios/test-map.json" with { type: "json" };
import { scenarioSchema } from "./scenario.ts";

type Lists = { era: string; countries: string[] }[];
type Data = {
  firstEra?: string;
  eras?: { era: string; turn: number; cards: string[] }[];
  map: { battlegrounds: Lists; [key: string]: unknown };
  [key: string]: unknown;
};

/** The paths of every problem the scenario schema finds after `change` edits a fresh copy of the test-map scenario. */
const paths = (change: (s: Data) => void): unknown[][] => {
  const s = JSON.parse(JSON.stringify(raw)) as Data;
  change(s);
  const r = scenarioSchema.safeParse(s);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};
const era1 = (s: Data) => s.map.battlegrounds[0]!;

describe("a scenario map's battleground lists", () => {
  it("accepts the test-map scenario, starting in era-1 (so each refusal below is caused by its own change)", () => {
    expect(paths(() => {})).toEqual([]);
    expect(raw.firstEra).toBe("era-1");
  });
  it("refuses a list naming an unknown country, at that country", () => {
    expect(paths((s) => era1(s).countries.push("nowhere"))).toEqual([
      ["map", "battlegrounds", 0, "countries", era1(raw as Data).countries.length],
    ]);
  });
  it("refuses a list naming a country twice, at the second", () => {
    const first = era1(raw as Data).countries[0]!;
    expect(paths((s) => era1(s).countries.push(first))).toEqual([
      ["map", "battlegrounds", 0, "countries", era1(raw as Data).countries.length],
    ]);
  });
  it("refuses two lists for one era, at the second", () => {
    const n = raw.map.battlegrounds.length;
    expect(paths((s) => s.map.battlegrounds.push({ era: "era-1", countries: [] }))).toEqual([
      ["map", "battlegrounds", n, "era"],
    ]);
  });
  it("refuses a list with an empty era name, or with other fields", () => {
    expect(paths((s) => (era1(s).era = ""))).toContainEqual(["map", "battlegrounds", 0, "era"]);
    expect(paths((s) => Object.assign(era1(s), { size: 1 }))).toEqual([["map", "battlegrounds", 0]]);
  });
  it("accepts an empty list: an era may have no battlegrounds", () => {
    expect(paths((s) => (era1(s).countries = []))).toEqual([]);
  });
  it("accepts lists for eras the scenario does not use", () => {
    expect(paths((s) => s.map.battlegrounds.push({ era: "era-9", countries: [] }))).toEqual([]);
  });
});

describe("a scenario's eras and the map's lists", () => {
  it("refuses a scenario with a map that names no first era", () => {
    expect(paths((s) => delete s.firstEra)).toEqual([["firstEra"]]);
  });
  it("refuses a first era with no list on the map", () => {
    expect(paths((s) => (s.firstEra = "era-0"))).toEqual([["map", "battlegrounds"]]);
  });
  it("refuses a later era with no list on the map", () => {
    const later = (s: Data) => (s.eras = [{ era: "era-9", turn: 2, cards: ["x1"] }]);
    expect(paths(later)).toEqual([["map", "battlegrounds"]]);
  });
  it("refuses a later era named like the first, at that era", () => {
    expect(paths((s) => (s.eras = [{ era: "era-1", turn: 2, cards: ["x1"] }]))).toEqual([["eras", 0, "era"]]);
  });
  it("refuses two later eras with the same name, at the second", () => {
    const twice = (s: Data) =>
      (s.eras = [
        { era: "era-2", turn: 2, cards: ["x1"] },
        { era: "era-2", turn: 3, cards: ["x2"] },
      ]);
    expect(paths(twice)).toEqual([["eras", 1, "era"]]);
  });
  it("accepts a first era with no map", () => {
    expect(paths((s) => delete (s as { map?: unknown }).map)).toEqual([]);
  });
});
