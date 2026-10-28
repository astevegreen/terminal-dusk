// #422: the six-region map as scenario data (docs/design/map-and-points.md, "Map"; owner, 28 Oct: option 2 of
// docs/proposals/map-content/, H1, Crimea its own box, closing order C1, scoring order S1).
import { createGame, seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { SIX_REGION_MAP_SCENARIO as exported } from "./index.ts";
import { scenarioSetup } from "./scenario.ts";
import { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";

const map = SIX_REGION_MAP_SCENARIO.map!;
const byId = new Map(map.countries.map((c) => [c.id, c]));
const neighboursOf = (id: string): readonly string[] => byId.get(id)?.neighbours ?? [];

/** Every country a side can reach by stepping from country to neighbouring country, starting next to its home box. */
function reachableFrom(start: readonly string[]): Set<string> {
  const seen = new Set(start);
  const queue = [...start];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const n of neighboursOf(id)) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

describe("the six-region map scenario (#422)", () => {
  it("is exported by packages/content", () => {
    expect(exported).toBe(SIX_REGION_MAP_SCENARIO);
  });

  it("says in its name that its numbers are placeholders", () => {
    expect(SIX_REGION_MAP_SCENARIO.id).toBe("six-region-map");
    expect(SIX_REGION_MAP_SCENARIO.name).toMatch(/placeholder/);
  });

  it("lists the six regions in the scoring order S1", () => {
    expect(map.regions).toEqual([
      { id: "eastern-europe-central-asia", name: "Eastern Europe and Central Asia" },
      { id: "east-south-asia", name: "East and South Asia" },
      { id: "europe", name: "Europe" },
      { id: "middle-east-north-africa", name: "Middle East and North Africa" },
      { id: "sub-saharan-africa", name: "Sub-Saharan Africa" },
      { id: "americas", name: "The Americas" },
    ]);
  });

  it("closes regions in order C1: Eastern Europe and Central Asia, then East and South Asia, then Europe", () => {
    expect(map.closingOrder).toEqual(["eastern-europe-central-asia", "east-south-asia", "europe"]);
  });

  it("has option 2's 41 countries plus Crimea: 9, 8, 8, 8, 4 and 5 per region", () => {
    expect(map.countries).toHaveLength(42);
    const perRegion = map.regions.map((r) => map.countries.filter((c) => c.region === r.id).length);
    expect(perRegion).toEqual([9, 8, 8, 8, 4, 5]);
  });

  it("has option 2's 17 battlegrounds in every era, three per region and two in Sub-Saharan Africa", () => {
    expect(map.battlegrounds.map((b) => b.era)).toEqual(["era-1", "era-2", "era-3", "future"]);
    for (const { countries } of map.battlegrounds) expect(countries).toEqual(map.battlegrounds[0]!.countries);
    expect(map.battlegrounds[0]!.countries.toSorted()).toEqual(
      [
        "germany",
        "poland",
        "serbia",
        "ukraine",
        "georgia",
        "kazakhstan",
        "syria",
        "iraq",
        "iran",
        "nigeria",
        "south-africa",
        "japan",
        "taiwan",
        "india",
        "mexico",
        "venezuela",
        "brazil",
      ].toSorted(),
    );
  });

  it("lists every link at both ends", () => {
    for (const c of map.countries) {
      for (const n of c.neighbours) expect(neighboursOf(n), `${c.id} lists ${n}`).toContain(c.id);
    }
  });

  it("makes Crimea its own box next to Ukraine, Turkey and the SAE box, with Turkey listing Crimea back", () => {
    const crimea = byId.get("crimea");
    expect(crimea).toMatchObject({ name: "Crimea", region: "eastern-europe-central-asia" });
    expect(map.battlegrounds.some((b) => b.countries.includes("crimea"))).toBe(false);
    expect(crimea?.neighbours.toSorted()).toEqual(["turkey", "ukraine"]);
    expect(neighboursOf("turkey")).toContain("crimea");
    expect(neighboursOf("ukraine")).toContain("crimea");
    expect(map.homeBox.sae).toContain("crimea");
  });

  it("puts the countries bordering Russia or China next to the SAE box (H1), and three next to the LIO box", () => {
    expect(map.homeBox.lio).toEqual(["canada", "mexico", "cuba"]);
    expect(map.homeBox.sae.toSorted()).toEqual(
      [
        "poland",
        "finland",
        "estonia",
        "belarus",
        "ukraine",
        "crimea",
        "georgia",
        "azerbaijan",
        "kazakhstan",
        "kyrgyzstan",
        "tajikistan",
        "japan",
        "north-korea",
        "taiwan",
        "india",
        "pakistan",
        "afghanistan",
      ].toSorted(),
    );
  });

  it("lets each side reach every country from its home box", () => {
    expect(reachableFrom(map.homeBox.lio).size).toBe(42);
    expect(reachableFrom(map.homeBox.sae).size).toBe(42);
  });

  it("starts Taiwan with LIO in control and Crimea with SAE influence, and every other country empty", () => {
    expect(map.startingInfluence).toEqual([
      { country: "taiwan", lio: 3, sae: 0 },
      { country: "crimea", lio: 0, sae: 1 },
    ]);
    expect(byId.get("taiwan")?.stability).toBe(3);
  });

  it("starts a game with the Era 1 cards as the host does: the engine accepts the map", () => {
    const setup = {
      seedHash: seedHash("map-seed"),
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(SIX_REGION_MAP_SCENARIO),
    };
    const result = createGame(FIRST_DECK_RULESET, setup, "map-seed");
    expect(result.ok, result.ok ? "" : result.error.code).toBe(true);
    if (!result.ok) return;
    const influence = result.value.state.public.influence;
    expect(influence).toHaveLength(42);
    expect(influence?.find((e) => e.country === "taiwan")).toEqual({ country: "taiwan", lio: 3, sae: 0 });
    expect(influence?.find((e) => e.country === "crimea")).toEqual({ country: "crimea", lio: 0, sae: 1 });
  });
});
