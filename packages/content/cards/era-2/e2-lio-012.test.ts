// e2-lio-012 Euro Cash: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-012 Euro Cash", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-012", {})).toEqual([
      "single currency",
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
