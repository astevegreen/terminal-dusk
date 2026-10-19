// e1-sae-012 Shock Therapy Backlash: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-012 Shock Therapy Backlash", () => {
  it("when LIO says yes", () => {
    expect(playCard("e1-sae-012", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "reform backlash",
      "points:sae:2",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
  it("when LIO says no", () => {
    expect(playCard("e1-sae-012", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "reform backlash",
      "points:sae:2",
      "left to themselves",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
