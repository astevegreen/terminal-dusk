import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/eraChecks.ts";

describe("@terminal-dusk/content entry point", () => {
  it("exports the scenario helpers, the six-region map and the test map scenario, and nothing else yet", () => {
    expect(Object.keys(entry).toSorted(byCodeUnit)).toEqual([
      "DEFAULT_CONTINGENCY",
      "SIX_REGION_MAP_SCENARIO",
      "TEST_MAP_SCENARIO",
      "scenarioSetup",
    ]);
  });
});
