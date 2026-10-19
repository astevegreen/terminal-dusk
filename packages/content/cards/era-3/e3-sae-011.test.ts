// e3-sae-011 Hong Kong Security Law: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-011 Hong Kong Security Law", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-sae-011", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "promise ended",
      "points:sae:2",
      "no sanctions",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-sae-011", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "promise ended",
      "points:sae:2",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
