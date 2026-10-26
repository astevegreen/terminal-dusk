import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/eraChecks.ts";

describe("@terminal-dusk/content entry point", () => {
  it("exports the scenario helpers and the test map scenario, and nothing else yet", () => {
    expect(Object.keys(entry).toSorted(byCodeUnit)).toEqual([
      "DEFAULT_CONTINGENCY",
      "TEST_MAP_SCENARIO",
      "scenarioSetup",
    ]);
  });
});
