// e3-lio-004 Iran: SWIFT Cutoff and the Deal: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-004 Iran: SWIFT Cutoff and the Deal", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-lio-004", { yes: { lio: false } })).toEqual([
      "disconnected",
      "points:lio:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-lio-004", { yes: { lio: true } })).toEqual([
      "disconnected",
      "points:lio:2",
      "deal signed",
      "points:lio:2",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
