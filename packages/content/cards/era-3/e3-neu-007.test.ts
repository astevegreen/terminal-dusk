// e3-neu-007 AI Compute Race: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-007 AI Compute Race", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-neu-007", { yes: { lio: false } })).toEqual([
      "compute race",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-neu-007", { yes: { lio: true } })).toEqual([
      "compute race",
      "points:lio:1",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
