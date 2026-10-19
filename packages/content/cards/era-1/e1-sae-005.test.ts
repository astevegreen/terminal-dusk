// e1-sae-005 The Hanssen Leak: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-005 The Hanssen Leak", () => {
  it("when SAE draws 2", () => {
    expect(playCard("e1-sae-005", { draw: 2 })).toEqual([
      "points:lio:2",
      "mole inside",
      "points:sae:2",
      "draw:sae:2",
      "mole caught",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("e1-sae-005", { draw: 3 })).toEqual([
      "points:lio:2",
      "mole inside",
      "points:sae:2",
      "draw:sae:3",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
