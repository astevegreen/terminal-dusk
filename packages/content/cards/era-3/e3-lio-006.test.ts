// e3-lio-006 Chip Chokepoint: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-006 Chip Chokepoint", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-lio-006", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and LIO draws 1", () => {
    expect(playCard("e3-lio-006", { yes: { lio: true }, draw: 1 })).toEqual([
      "draw:lio:1",
      "controls leak",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and LIO draws 3", () => {
    expect(playCard("e3-lio-006", { yes: { lio: true }, draw: 3 })).toEqual([
      "draw:lio:3",
      "chokepoint sealed",
      "points:lio:3",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
