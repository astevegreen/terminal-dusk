// e3-sae-008 Syrian Intervention: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-008 Syrian Intervention", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-008", {})).toEqual([
      "points:lio:2",
      "proxy war",
      "points:sae:2",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
