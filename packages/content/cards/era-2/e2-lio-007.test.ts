// e2-lio-007 Big Bang Enlargement 2004: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-007 Big Bang Enlargement 2004", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-007", {})).toEqual([
      "eastward",
      "points:lio:3",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
