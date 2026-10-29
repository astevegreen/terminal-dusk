import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/sort.ts";

describe("@terminal-dusk/engine entry point", () => {
  it("exports exactly the public functions, SIDES and DECKS (types aside)", () => {
    expect(Object.keys(entry).toSorted(byCodeUnit)).toEqual([
      "DECKS",
      "SIDES",
      "apply",
      "closedRegions",
      "controller",
      "createGame",
      "eventsFor",
      "hiddenPart",
      "isBattleground",
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
