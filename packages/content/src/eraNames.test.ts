import { describe, expect, it } from "vitest";
import { SIX_REGION_MAP_SCENARIO } from "./index.ts";
import {
  ERA_1_FREE_SCENARIO,
  ERA_NAMES,
  ERA_TITLES,
  FIRST_DECK_CARDS,
  FIRST_DECK_SCENARIO,
  SCENARIO_2025_2027,
} from "./firstDeck.ts";

describe("the era names players see", () => {
  it("give each era its name, number and years, and the future cards theirs (docs/design/eras.md)", () => {
    expect(ERA_NAMES).toEqual({
      "era-1": "The Thaw (Era 1, 1991–2001)",
      "era-2": "The Shock (Era 2, 2001–2008)",
      "era-3": "The Fracture (Era 3, 2008–2025)",
      future: "Future cards (2025–2027)",
    });
  });
  it("have a short form without the years", () => {
    expect(ERA_TITLES).toEqual({
      "era-1": "The Thaw (Era 1)",
      "era-2": "The Shock (Era 2)",
      "era-3": "The Fracture (Era 3)",
      future: "Future cards",
    });
  });
  it("cover every era a first-deck card or a shipped scenario names", () => {
    const scenarios = [FIRST_DECK_SCENARIO, ERA_1_FREE_SCENARIO, SCENARIO_2025_2027, SIX_REGION_MAP_SCENARIO];
    const eras = new Set([
      ...FIRST_DECK_CARDS.map((c) => c.era),
      ...scenarios.flatMap((s) => [s.firstEra, ...(s.eras ?? []).map((e) => e.era)]),
    ]);
    eras.delete(undefined);
    expect(eras.size).toBeGreaterThan(3);
    for (const era of eras) {
      expect(Object.hasOwn(ERA_NAMES, era!), era).toBe(true);
      expect(Object.hasOwn(ERA_TITLES, era!), era).toBe(true);
    }
  });
});
