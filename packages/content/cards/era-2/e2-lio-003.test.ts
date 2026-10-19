// e2-lio-003 Colour Revolutions: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-003 Colour Revolutions", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-003", {})).toEqual([
      "colour revolution",
      "points:lio:2",
      "mod:lio:+1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
    ]);
  });
});
