// e3-sae-002 Belt and Road: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-002 Belt and Road", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-sae-002", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "corridors",
      "points:sae:3",
      "unanswered",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-sae-002", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "corridors",
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
