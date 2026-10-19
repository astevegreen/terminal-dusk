// e1-sae-007 Taiwan Strait Crisis: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-007 Taiwan Strait Crisis", () => {
  it("when LIO says yes", () => {
    expect(playCard("e1-sae-007", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "strait crisis",
      "points:lio:2",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
  it("when LIO says no", () => {
    expect(playCard("e1-sae-007", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "strait crisis",
      "points:sae:3",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
