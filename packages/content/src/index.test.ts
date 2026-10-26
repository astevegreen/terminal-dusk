import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/content entry point", () => {
  it("exports the scenario helpers and the test map scenario, and nothing else yet", () => {
    expect(Object.keys(entry).sort()).toEqual(["DEFAULT_CONTINGENCY", "TEST_MAP_SCENARIO", "scenarioSetup"]);
  });
});
