// e1-sae-003 Golden Shield: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-003 Golden Shield", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-sae-003", {})).toEqual([
      "points:lio:2",
      "walled network",
      "points:sae:1",
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
