// createGame refuses a bad map with invalidSetup and a message naming the problem: one test per refusal.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { EngineError, SetupMap } from "./index.ts";
import { ruleset } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";

/** The test map changed by `edit`, given to createGame; the error it returns, or null. */
function refusal(edit: (map: SetupMap) => void): EngineError | null {
  const map = testMap();
  edit(map);
  const r = createGame(ruleset, mapSetup(map), "seed-1");
  return r.ok ? null : r.error;
}
const country = (map: SetupMap, id: string) => map.countries.find((c) => c.id === id)!;

describe("createGame refuses a bad map", () => {
  it("accepts the test map (so each refusal below is caused by its own change)", () => {
    expect(refusal(() => {})).toBeNull();
  });
  it("refuses a map with no regions", () => {
    expect(refusal((m) => (m.regions = []))).toMatchObject({ code: "invalidSetup", message: /no regions/ });
  });
  it("refuses a map with no countries", () => {
    expect(refusal((m) => (m.countries = []))).toMatchObject({ code: "invalidSetup", message: /no countries/ });
  });
  it("refuses a region whose id is an empty string", () => {
    expect(refusal((m) => (m.regions[0]!.id = ""))).toMatchObject({ code: "invalidSetup", message: /region.*id/ });
  });
  it("refuses a region whose name is an empty string", () => {
    expect(refusal((m) => (m.regions[0]!.name = ""))).toMatchObject({ code: "invalidSetup", message: /north.*name/ });
  });
  it("refuses a country whose id is an empty string", () => {
    expect(refusal((m) => (m.countries[0]!.id = ""))).toMatchObject({ code: "invalidSetup", message: /country.*id/ });
  });
  it("refuses a country whose name is an empty string", () => {
    expect(refusal((m) => (country(m, "bravo").name = ""))).toMatchObject({
      code: "invalidSetup",
      message: /bravo.*name/,
    });
  });
  it("refuses two regions with the same id", () => {
    expect(refusal((m) => (m.regions[1]!.id = "north"))).toMatchObject({
      code: "invalidSetup",
      message: /Two regions.*north/,
    });
  });
  it("refuses two countries with the same id", () => {
    expect(refusal((m) => m.countries.push({ ...country(m, "echo") }))).toMatchObject({
      code: "invalidSetup",
      message: /Two countries.*echo/,
    });
  });
  it("refuses a country naming an unknown region", () => {
    expect(refusal((m) => (country(m, "echo").region = "west"))).toMatchObject({
      code: "invalidSetup",
      message: /echo.*unknown region west/,
    });
  });
  it("refuses a country naming an unknown neighbour", () => {
    expect(refusal((m) => country(m, "echo").neighbours.push("zulu"))).toMatchObject({
      code: "invalidSetup",
      message: /echo.*unknown neighbour zulu/,
    });
  });
  it("refuses a home-box list naming an unknown country", () => {
    expect(refusal((m) => m.homeBox.sae.push("zulu"))).toMatchObject({
      code: "invalidSetup",
      message: /sae home box.*unknown country zulu/,
    });
  });
  it("refuses a country listing itself as a neighbour", () => {
    expect(refusal((m) => country(m, "echo").neighbours.push("echo"))).toMatchObject({
      code: "invalidSetup",
      message: /echo.*itself/,
    });
  });
  it("refuses a country listing a neighbour twice", () => {
    expect(refusal((m) => country(m, "echo").neighbours.push("delta"))).toMatchObject({
      code: "invalidSetup",
      message: /echo.*delta twice/,
    });
  });
  it("refuses a side's home-box list naming a country twice", () => {
    expect(refusal((m) => m.homeBox.lio.push("alpha"))).toMatchObject({
      code: "invalidSetup",
      message: /lio home box.*alpha twice/,
    });
  });
  it("refuses adjacency that is not two-way", () => {
    expect(refusal((m) => (country(m, "echo").neighbours = []))).toMatchObject({
      code: "invalidSetup",
      message: /delta.*echo.*echo.*not.*delta/,
    });
  });
  it("refuses a stability that is not a whole number", () => {
    expect(refusal((m) => (country(m, "alpha").stability = 1.5))).toMatchObject({
      code: "invalidSetup",
      message: /alpha.*stability.*whole number, 1 or more/,
    });
  });
  it("refuses a stability below 1", () => {
    expect(refusal((m) => (country(m, "alpha").stability = 0))).toMatchObject({
      code: "invalidSetup",
      message: /alpha.*stability.*whole number, 1 or more/,
    });
  });
  it("refuses a region with no country", () => {
    expect(refusal((m) => m.regions.push({ id: "west", name: "West" }))).toMatchObject({
      code: "invalidSetup",
      message: /west.*no country/,
    });
  });
  it("refuses a starting-influence entry naming an unknown country", () => {
    expect(refusal((m) => m.startingInfluence.push({ country: "zulu", lio: 1, sae: 0 }))).toMatchObject({
      code: "invalidSetup",
      message: /Starting influence.*unknown country zulu/,
    });
  });
  it("refuses a starting-influence entry naming a country already listed", () => {
    expect(refusal((m) => m.startingInfluence.push({ country: "alpha", lio: 1, sae: 0 }))).toMatchObject({
      code: "invalidSetup",
      message: /Starting influence.*alpha twice/,
    });
  });
  it("refuses a starting-influence amount that is not a whole number", () => {
    expect(refusal((m) => (m.startingInfluence[0]!.lio = 0.5))).toMatchObject({
      code: "invalidSetup",
      message: /alpha.*lio.*whole number, 0 or more/,
    });
  });
  it("refuses a starting-influence amount below 0", () => {
    expect(refusal((m) => (m.startingInfluence[1]!.sae = -1))).toMatchObject({
      code: "invalidSetup",
      message: /echo.*sae.*whole number, 0 or more/,
    });
  });
  it("refuses, without throwing, a map whose parts are not the right shape", () => {
    const broken = [
      () => null,
      (m: SetupMap) => ({ ...m, regions: "north" }),
      (m: SetupMap) => ({ ...m, countries: [null] }),
      (m: SetupMap) => ({ ...m, homeBox: { lio: ["alpha"] } }),
      (m: SetupMap) => ({ ...m, startingInfluence: undefined }),
      (m: SetupMap) => ({ ...m, countries: m.countries.map((c) => ({ ...c, neighbours: "x" })) }),
      (m: SetupMap) => ({ ...m, countries: m.countries.map((c) => ({ ...c, battleground: "yes" })) }),
    ];
    for (const make of broken) {
      const map = make(testMap()) as unknown as SetupMap;
      const r = createGame(ruleset, mapSetup(map), "seed-1");
      expect(r.ok ? null : r.error.code).toBe("invalidSetup");
    }
  });
});
