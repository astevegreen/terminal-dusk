// e2-lio-001 Jawbreaker: Fall of the Taliban: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-001 Jawbreaker: Fall of the Taliban", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-001", {})).toEqual([
      "swift campaign",
      "points:lio:2",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
