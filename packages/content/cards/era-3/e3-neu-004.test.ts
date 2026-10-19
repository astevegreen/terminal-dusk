// e3-neu-004 Migration Crisis 2015: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-004 Migration Crisis 2015", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-neu-004", {})).toEqual([
      "a million arrivals",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
