import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/engine entry point", () => {
  it("exports exactly the public functions, SIDES and DECKS (types aside)", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "DECKS",
      "SIDES",
      "apply",
      "closedRegions",
      "controller",
      "createGame",
      "eventsFor",
      "hiddenPart",
      "isRegionClosed",
      "legalAnswers",
      "pendingFor",
      "placementCost",
      "reconstruct",
      "seedHash",
      "verifyGame",
      "viewFor",
    ]);
  });
});
