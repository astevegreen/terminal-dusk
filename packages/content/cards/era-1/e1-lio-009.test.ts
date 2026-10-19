// e1-lio-009 Peso Bailout: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-009 Peso Bailout", () => {
  it("when LIO says yes", () => {
    expect(playCard("e1-lio-009", { yes: { lio: true } })).toEqual([
      "rescue",
      "points:lio:2",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
  it("when LIO says no", () => {
    expect(playCard("e1-lio-009", { yes: { lio: false } })).toEqual([
      "rescue",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
