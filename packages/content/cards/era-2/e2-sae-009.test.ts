// e2-sae-009 Argentine Default: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-009 Argentine Default", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-sae-009", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "consensus cracks",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e2-sae-009", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "consensus cracks",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
