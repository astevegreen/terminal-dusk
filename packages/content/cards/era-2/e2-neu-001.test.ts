// e2-neu-001 China Joins the WTO: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-001 China Joins the WTO", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-neu-001", { yes: { lio: false } })).toEqual([
      "open trade",
      "points:lio:1",
      "points:sae:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e2-neu-001", { yes: { lio: true } })).toEqual([
      "open trade",
      "points:lio:1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
