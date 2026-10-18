import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/content entry point", () => {
  it("exports the scenario helpers and nothing else yet", () => {
    expect(Object.keys(entry).sort()).toEqual(["DEFAULT_CONTINGENCY", "scenarioSetup"]);
  });
});
