// e1-sae-013 Cox Report: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-013 Cox Report", () => {
  it("when SAE draws 2", () => {
    expect(playCard("e1-sae-013", { draw: 2 })).toEqual([
      "points:lio:2",
      "designs copied",
      "draw:sae:2",
      "ring exposed",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("e1-sae-013", { draw: 3 })).toEqual([
      "points:lio:2",
      "designs copied",
      "draw:sae:3",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
