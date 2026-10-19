// ef-lio-001 Allied Drone Wall: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-lio-001 Allied Drone Wall", () => {
  it("plays out as its text says", () => {
    expect(playCard("ef-lio-001", {})).toEqual([
      "sensors along the frontier",
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
