// e2-lio-004 ABM Treaty Withdrawal: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-004 ABM Treaty Withdrawal", () => {
  it("when LIO says no", () => {
    expect(playCard("e2-lio-004", { yes: { lio: false } })).toEqual([
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e2-lio-004", { yes: { lio: true } })).toEqual([
      "treaty gone",
      "points:lio:2",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
