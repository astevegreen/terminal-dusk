// e2-sae-006 Gas Cutoff: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-006 Gas Cutoff", () => {
  it("when SAE says no", () => {
    expect(playCard("e2-sae-006", { yes: { sae: false } })).toEqual([
      "points:lio:2",
      "valves closed",
      "points:sae:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e2-sae-006", { yes: { sae: true } })).toEqual([
      "points:lio:2",
      "valves closed",
      "points:sae:2",
      "mod:sae:-1:min1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:1",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
