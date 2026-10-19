// e2-sae-011 Munich Speech 2007: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-011 Munich Speech 2007", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-011", {})).toEqual([
      "points:lio:2",
      "unipolar moment over",
      "mod:sae:+1",
      "points:lio:2",
      "points:sae:3",
    ]);
  });
});
