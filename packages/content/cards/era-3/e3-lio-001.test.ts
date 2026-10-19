// e3-lio-001 Stuxnet: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-001 Stuxnet", () => {
  it("when LIO draws 1", () => {
    expect(playCard("e3-lio-001", { draw: 1 })).toEqual([
      "draw:lio:1",
      "cyberweapon loose",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO draws 3", () => {
    expect(playCard("e3-lio-001", { draw: 3 })).toEqual([
      "draw:lio:3",
      "centrifuges spin apart",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
