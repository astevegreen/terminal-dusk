// e2-neu-005 Oil at $147: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-005 Oil at $147", () => {
  it("when SAE says no", () => {
    expect(playCard("e2-neu-005", { yes: { sae: false } })).toEqual([
      "oil spike",
      "points:sae:2",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e2-neu-005", { yes: { sae: true } })).toEqual([
      "oil spike",
      "points:sae:1",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
