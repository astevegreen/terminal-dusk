// e2-sae-002 Curveball: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-002 Curveball", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-sae-002", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and SAE draws 2", () => {
    expect(playCard("e2-sae-002", { yes: { lio: true }, draw: 2 })).toEqual([
      "points:lio:2",
      "draw:sae:2",
      "points:lio:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and SAE draws 3", () => {
    expect(playCard("e2-sae-002", { yes: { lio: true }, draw: 3 })).toEqual([
      "points:lio:2",
      "draw:sae:3",
      "intelligence discredited",
      "points:sae:1",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
