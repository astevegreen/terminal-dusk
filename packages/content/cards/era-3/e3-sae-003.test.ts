// e3-sae-003 Annexation of Crimea: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-003 Annexation of Crimea", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-003", {})).toEqual([
      "points:lio:2",
      "borders redrawn",
      "points:sae:3",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
