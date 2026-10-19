// e1-sae-011 Pristina Airport Dash: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-011 Pristina Airport Dash", () => {
  it("when LIO says yes and SAE draws 3", () => {
    expect(playCard("e1-sae-011", { yes: { lio: true }, draw: 3 })).toEqual([
      "points:lio:2",
      "airport seized",
      "points:sae:1",
      "draw:sae:3",
      "points:lio:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and SAE draws 4", () => {
    expect(playCard("e1-sae-011", { yes: { lio: true }, draw: 4 })).toEqual([
      "points:lio:2",
      "airport seized",
      "points:sae:1",
      "draw:sae:4",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says no", () => {
    expect(playCard("e1-sae-011", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "airport seized",
      "points:sae:1",
      "stand-off avoided",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
