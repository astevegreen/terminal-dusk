// e3-lio-011 Private Constellation: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-011 Private Constellation", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-lio-011", {})).toEqual([
      "constellation",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
