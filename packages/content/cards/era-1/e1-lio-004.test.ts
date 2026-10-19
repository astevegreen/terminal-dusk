// e1-lio-004 NATO Enlargement 1999: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-004 NATO Enlargement 1999", () => {
  it("when SAE says yes and LIO draws 3", () => {
    expect(playCard("e1-lio-004", { yes: { sae: true }, draw: 3 })).toEqual([
      "enlargement",
      "points:lio:2",
      "draw:lio:3",
      "points:sae:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes and LIO draws 4", () => {
    expect(playCard("e1-lio-004", { yes: { sae: true }, draw: 4 })).toEqual([
      "enlargement",
      "points:lio:2",
      "draw:lio:4",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says no", () => {
    expect(playCard("e1-lio-004", { yes: { sae: false } })).toEqual([
      "enlargement",
      "points:lio:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
