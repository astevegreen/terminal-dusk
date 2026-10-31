// #422: the six-region map as scenario data (docs/design/map-and-points.md, "Map"; owner, 28 Oct: option 2 of
// docs/proposals/map-content/, H1, Crimea its own box, closing order C1, scoring order S1); its numbers (R24, #458).
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

// Option A of docs/proposals/map-numbers/option-a-history.md, as the owner chose it on 28 Oct (R24, #458).
const STABILITY: Record<string, number> = {
  // Eastern Europe and Central Asia
  estonia: 3,
  belarus: 3,
  ukraine: 2,
  crimea: 2,
  georgia: 1,
  azerbaijan: 2,
  kazakhstan: 3,
  kyrgyzstan: 1,
  tajikistan: 1,
  // East and South Asia
  japan: 4,
  "south-korea": 3,
  "north-korea": 4,
  taiwan: 3,
  india: 3,
  pakistan: 2,
  afghanistan: 1,
  australia: 4,
  // Europe
  "united-kingdom": 4,
  france: 4,
  germany: 4,
  italy: 3,
  poland: 3,
  finland: 4,
  serbia: 2,
  greece: 3,
  // Middle East and North Africa
  turkey: 3,
  libya: 1,
  israel: 4,
  lebanon: 1,
  syria: 2,
  iraq: 1,
  iran: 3,
  "saudi-arabia": 3,
  // Sub-Saharan Africa
  nigeria: 1,
  rwanda: 1,
  somalia: 1,
  "south-africa": 3,
  // The Americas
  canada: 4,
  mexico: 2,
  cuba: 3,
  venezuela: 2,
  brazil: 2,
};
const ERA_1 = [
  "ukraine",
  "georgia",
  "kazakhstan",
  "germany",
  "poland",
  "serbia",
  "iraq",
  "iran",
  "israel",
  "rwanda",
  "nigeria",
  "south-africa",
  "japan",
  "north-korea",
  "taiwan",
  "india",
  "mexico",
  "cuba",
  "brazil",
];
const ERA_2 = [
  "ukraine",
  "georgia",
  "kyrgyzstan",
  "germany",
  "france",
  "poland",
  "iraq",
  "iran",
  "lebanon",
  "saudi-arabia",
  "nigeria",
  "somalia",
  "south-africa",
  "north-korea",
  "india",
  "pakistan",
  "afghanistan",
  "mexico",
  "venezuela",
  "brazil",
];
const ERA_3 = [
  "ukraine",
  "crimea",
  "belarus",
  "kazakhstan",
  "germany",
  "poland",
  "greece",
  "turkey",
  "libya",
  "syria",
  "iran",
  "nigeria",
  "south-africa",
  "japan",
  "taiwan",
  "india",
  "mexico",
  "venezuela",
  "brazil",
];
const AMOUNTS = [
  { region: "eastern-europe-central-asia", present: 2, ahead: 5, all: 8 },
  { region: "east-south-asia", present: 2, ahead: 5, all: 8 },
  { region: "europe", present: 2, ahead: 5, all: 8 },
  { region: "middle-east-north-africa", present: 2, ahead: 4, all: 6 },
  { region: "sub-saharan-africa", present: 1, ahead: 3, all: 4 },
  { region: "americas", present: 1, ahead: 3, all: 5 },
];

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

  it("says in its name which numbers are still placeholders: turns, plays and hand size", () => {
    expect(SIX_REGION_MAP_SCENARIO.id).toBe("six-region-map");
    expect(SIX_REGION_MAP_SCENARIO.name).toMatch(/placeholder turns, plays and hand size/);
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

  // R24 (#458; owner, 28 Oct: "A, tune later"): option A of docs/proposals/map-numbers/, until the balance pass.
  it("has option A's stabilities, 106 in all", () => {
    expect(Object.fromEntries(map.countries.map((c) => [c.id, c.stability]))).toEqual(STABILITY);
    expect(map.countries.reduce((sum, c) => sum + c.stability, 0)).toBe(106);
  });

  // R24 (owner, 28 Oct: "A, move with history"): each era its own list; the future era keeps Era 3's.
  it("has option A's battleground lists: 19, 20 and 19, and the future era keeps Era 3's", () => {
    expect(map.battlegrounds.map((b) => b.era)).toEqual(["era-1", "era-2", "era-3", "future"]);
    const lists = [ERA_1, ERA_2, ERA_3, ERA_3];
    map.battlegrounds.forEach(({ era, countries }, i) =>
      expect(countries.toSorted(), era).toEqual(lists[i]!.toSorted()),
    );
    expect(map.battlegrounds.map((b) => b.countries.length)).toEqual([19, 20, 19, 19]);
    expect(map.battlegrounds[3]!.countries).toEqual(map.battlegrounds[2]!.countries);
  });

  // R24 (owner, 28 Oct: "Weighted, 20, middle"): option A's amounts, 20 steps each way, starting in the middle.
  it("scores with option A's weighted amounts on a 20-step track that starts in the middle", () => {
    expect(map.scoring).toEqual({ track: { end: 20, start: 0 }, regions: AMOUNTS });
    expect(map.scoring!.regions.map((r) => r.region)).toEqual(map.regions.map((r) => r.id));
  });

  // R25 (#462; docs/design/tech-race.md, "The track"): four named steps costing 1 to 4, 4+ to move, Hypersonics escalates.
  it("has the tech race track the doc decided", () => {
    expect(map.techRace).toEqual({
      steps: [
        { name: "Networks and Orbit", cost: 1 },
        { name: "AI", cost: 2 },
        { name: "Hypersonics", cost: 3 },
        { name: "Quantum Computing", cost: 4 },
      ],
      success: 4,
      escalateAt: 3,
    });
  });

  it("lists every link at both ends", () => {
    for (const c of map.countries) {
      for (const n of c.neighbours) expect(neighboursOf(n), `${c.id} lists ${n}`).toContain(c.id);
    }
  });

  it("makes Crimea its own box next to Ukraine, Turkey and the SAE box, with Turkey listing Crimea back", () => {
    const crimea = byId.get("crimea");
    expect(crimea).toMatchObject({ name: "Crimea", region: "eastern-europe-central-asia" });
    expect(map.battlegrounds.filter((b) => b.countries.includes("crimea")).map((b) => b.era)).toEqual([
      "era-3",
      "future",
    ]);
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

  // R24 (owner, 28 Oct: "LIO 3 / SAE 1"), then X15 option 1 (owner, 29 Oct, #472): Taiwan LIO-aligned at 2, below
  // its stability 3, so not controlled; Crimea an SAE foothold, not control.
  it("starts Taiwan LIO-aligned but not controlled and Crimea with SAE influence, and every other country empty", () => {
    expect(map.startingInfluence).toEqual([
      { country: "taiwan", lio: 2, sae: 0 },
      { country: "crimea", lio: 0, sae: 1 },
    ]);
    expect(byId.get("taiwan")?.stability).toBe(3);
    expect(byId.get("crimea")?.stability).toBe(2);
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
    expect(influence?.find((e) => e.country === "taiwan")).toEqual({ country: "taiwan", lio: 2, sae: 0 });
    expect(influence?.find((e) => e.country === "crimea")).toEqual({ country: "crimea", lio: 0, sae: 1 });
    expect(result.value.state.public.map?.techRace).toEqual(map.techRace);
    expect(result.value.state.public.techRace).toEqual({ marker: 0, attempted: [], reached: [], bonus: [] });
  });
});
