// e1-sae-006 Shanghai Five: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-006 Shanghai Five", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-sae-006", {})).toEqual([
      "points:lio:2",
      "entente formed",
      "points:sae:2",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
});
