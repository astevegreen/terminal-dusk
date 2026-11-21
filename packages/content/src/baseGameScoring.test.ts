// The base game's era ends (docs/design/eras.md, "The base game"; docs/design/map-and-points.md, "Scoring"): Era 1
// lasts turns 1-3, Era 2 turns 4-5 and Era 3 turns 6-10, so the regions score at the ends of turns 3, 5 and 10 and
// at no other turn. The base game has no map of its own, so it is played on the six-region map, as the host's
// sixRegionMapConfig plays it. The scoring turns come from the engine's regionScored events, not from the file.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { scenarioSetup } from "./scenario.ts";
import { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";
import { playScenario } from "./test/playScenario.ts";

const SIX_REGION_MAP = scenarioSetup(SIX_REGION_MAP_SCENARIO).map;

describe("the base game's era scoring (owner, 21 Nov 2026: eras of 3, 2 and 5 turns)", () => {
  it("plays on a map that scores, so every era end shows", () => {
    expect(SIX_REGION_MAP?.scoring?.regions.length).toBeGreaterThan(0);
  });
  it.each(["score-a", "score-b", "score-c"])(
    "scores at the ends of turns 3, 5 and 10 and at no other turn (seed %s)",
    (seed) => {
      const { scoredTurns, eraTurns, last } = playScenario(FIRST_DECK_SCENARIO, seed, SIX_REGION_MAP);
      expect(last.public.status).toMatchObject({ kind: "over" });
      expect(last.public.turn).toBe(10);
      expect(eraTurns).toEqual({ "era-2": 4, "era-3": 6 });
      expect(scoredTurns).toEqual([3, 5, 10]);
    },
    60_000,
  );
});
