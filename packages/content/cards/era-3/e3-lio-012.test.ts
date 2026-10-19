// e3-lio-012 Salisbury and the Sleuths: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-012 Salisbury and the Sleuths", () => {
  it("when SAE says no", () => {
    expect(playCard("e3-lio-012", { yes: { sae: false } })).toEqual([
      "nerve agent",
      "points:lio:1",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes and LIO draws 1", () => {
    expect(playCard("e3-lio-012", { yes: { sae: true }, draw: 1 })).toEqual([
      "nerve agent",
      "points:lio:1",
      "draw:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes and LIO draws 3", () => {
    expect(playCard("e3-lio-012", { yes: { sae: true }, draw: 3 })).toEqual([
      "nerve agent",
      "points:lio:1",
      "draw:lio:3",
      "officers named",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
