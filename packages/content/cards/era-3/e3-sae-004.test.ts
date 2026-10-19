// e3-sae-004 Full-Scale Invasion: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-004 Full-Scale Invasion", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-004", {})).toEqual([
      "points:lio:2",
      "full-scale war",
      "points:sae:3",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
