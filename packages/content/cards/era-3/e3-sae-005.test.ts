// e3-sae-005 The Leaks: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-005 The Leaks", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-005", {})).toEqual([
      "points:lio:2",
      "surveillance exposed",
      "triggerSet:cardPlayed",
      "points:lio:2",
      "triggerFired:cardPlayed",
      "points:sae:1",
      "points:sae:2",
      "triggerFired:cardPlayed",
      "points:sae:1",
    ]);
  });
});
