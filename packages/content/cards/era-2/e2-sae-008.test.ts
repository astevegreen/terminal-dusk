// e2-sae-008 Petrocaribe: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-008 Petrocaribe", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-008", {})).toEqual([
      "points:lio:2",
      "oil diplomacy",
      "points:sae:2",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
