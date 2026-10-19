// e3-sae-009 Parallel Plumbing: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-009 Parallel Plumbing", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-sae-009", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "parallel plumbing",
      "points:sae:2",
      "stayed out",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-sae-009", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "parallel plumbing",
      "points:sae:2",
      "points:lio:1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
