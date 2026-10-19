// e2-neu-008 Sovereign Wealth Funds: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-008 Sovereign Wealth Funds", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-neu-008", { yes: { lio: false } })).toEqual([
      "petro-dollars",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e2-neu-008", { yes: { lio: true } })).toEqual([
      "petro-dollars",
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
