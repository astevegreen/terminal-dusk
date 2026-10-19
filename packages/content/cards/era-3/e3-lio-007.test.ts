// e3-lio-007 Sanctions Wall: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-007 Sanctions Wall", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-lio-007", {})).toEqual([
      "reserves frozen",
      "points:lio:3",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
