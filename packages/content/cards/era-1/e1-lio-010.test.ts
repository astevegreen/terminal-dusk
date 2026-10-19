// e1-lio-010 Arrest of Aldrich Ames: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-010 Arrest of Aldrich Ames", () => {
  it("when LIO draws 3", () => {
    expect(playCard("e1-lio-010", { draw: 3 })).toEqual([
      "mole exposed",
      "points:lio:1",
      "draw:lio:3",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO draws 4", () => {
    expect(playCard("e1-lio-010", { draw: 4 })).toEqual([
      "mole exposed",
      "points:lio:1",
      "draw:lio:4",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
