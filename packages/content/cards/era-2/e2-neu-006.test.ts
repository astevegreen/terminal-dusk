// e2-neu-006 Natanz Revealed: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-006 Natanz Revealed", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-neu-006", {})).toEqual([
      "programme revealed",
      "points:sae:1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
});
