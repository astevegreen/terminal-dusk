// e2-lio-009 Ana Montes Unmasked: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-009 Ana Montes Unmasked", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-009", {})).toEqual([
      "mole exposed",
      "points:lio:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
