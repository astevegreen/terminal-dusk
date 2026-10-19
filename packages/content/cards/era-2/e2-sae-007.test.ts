// e2-sae-007 North Korean Nuclear Test: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-007 North Korean Nuclear Test", () => {
  it("when SAE draws 2", () => {
    expect(playCard("e2-sae-007", { draw: 2 })).toEqual([
      "points:lio:2",
      "first test",
      "draw:sae:2",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("e2-sae-007", { draw: 3 })).toEqual([
      "points:lio:2",
      "first test",
      "draw:sae:3",
      "points:sae:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 4", () => {
    expect(playCard("e2-sae-007", { draw: 4 })).toEqual([
      "points:lio:2",
      "first test",
      "draw:sae:4",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
