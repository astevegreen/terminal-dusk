// e1-sae-004 Second Chechen War: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-004 Second Chechen War", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-sae-004", {})).toEqual([
      "points:lio:2",
      "consolidation",
      "points:sae:3",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
