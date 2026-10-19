// e2-lio-011 Cedar Revolution: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-011 Cedar Revolution", () => {
  it("when SAE says no", () => {
    expect(playCard("e2-lio-011", { yes: { sae: false } })).toEqual([
      "troops out",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes and LIO draws 3", () => {
    expect(playCard("e2-lio-011", { yes: { sae: true }, draw: 3 })).toEqual([
      "troops out",
      "draw:lio:3",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes and LIO draws 4", () => {
    expect(playCard("e2-lio-011", { yes: { sae: true }, draw: 4 })).toEqual([
      "troops out",
      "draw:lio:4",
      "points:sae:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
