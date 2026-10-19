// e3-sae-001 Global Financial Crisis: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-001 Global Financial Crisis", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-001", {})).toEqual([
      "points:lio:2",
      "credit crunch",
      "mod:both:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
