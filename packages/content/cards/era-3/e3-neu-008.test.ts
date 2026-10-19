// e3-neu-008 Tariff Shock: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-008 Tariff Shock", () => {
  it("when SAE says no", () => {
    expect(playCard("e3-neu-008", { yes: { sae: false } })).toEqual([
      "tariff wall",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e3-neu-008", { yes: { sae: true } })).toEqual([
      "tariff wall",
      "mod:lio:-1:min1",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
