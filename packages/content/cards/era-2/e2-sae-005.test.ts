// e2-sae-005 Litvinenko Poisoning: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-005 Litvinenko Poisoning", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-sae-005", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "polonium",
      "points:sae:1",
      "unanswered",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e2-sae-005", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "polonium",
      "points:sae:1",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
