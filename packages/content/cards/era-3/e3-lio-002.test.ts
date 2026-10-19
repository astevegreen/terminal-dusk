// e3-lio-002 Neptune Spear: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-002 Neptune Spear", () => {
  it("when LIO draws 1", () => {
    expect(playCard("e3-lio-002", { draw: 1 })).toEqual([
      "draw:lio:1",
      "raid fails",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO draws 2", () => {
    expect(playCard("e3-lio-002", { draw: 2 })).toEqual([
      "draw:lio:2",
      "raid succeeds",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
