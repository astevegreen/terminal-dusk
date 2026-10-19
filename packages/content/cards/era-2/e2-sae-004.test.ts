// e2-sae-004 Estonian Cyberattacks 2007: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-004 Estonian Cyberattacks 2007", () => {
  it("when SAE draws 2", () => {
    expect(playCard("e2-sae-004", { draw: 2 })).toEqual([
      "points:lio:2",
      "draw:sae:2",
      "cyber defence doctrine",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("e2-sae-004", { draw: 3 })).toEqual([
      "points:lio:2",
      "draw:sae:3",
      "sites down",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
