// e3-sae-012 Hypersonics on Parade: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-012 Hypersonics on Parade", () => {
  it("when SAE draws 1", () => {
    expect(playCard("e3-sae-012", { draw: 1 })).toEqual([
      "points:lio:2",
      "new missiles",
      "draw:sae:1",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("e3-sae-012", { draw: 3 })).toEqual([
      "points:lio:2",
      "new missiles",
      "draw:sae:3",
      "points:sae:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 4", () => {
    expect(playCard("e3-sae-012", { draw: 4 })).toEqual([
      "points:lio:2",
      "new missiles",
      "draw:sae:4",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
