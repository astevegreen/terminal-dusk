// e1-lio-003 Dayton Accords: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-003 Dayton Accords", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-lio-003", {})).toEqual([
      "peace enforced",
      "points:lio:2",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
