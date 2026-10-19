// e2-lio-005 Banco Delta Asia: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-005 Banco Delta Asia", () => {
  it("when LIO draws 2", () => {
    expect(playCard("e2-lio-005", { draw: 2 })).toEqual([
      "accounts frozen",
      "draw:lio:2",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO draws 3", () => {
    expect(playCard("e2-lio-005", { draw: 3 })).toEqual([
      "accounts frozen",
      "draw:lio:3",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
