// e3-neu-005 Populist Wave: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-005 Populist Wave", () => {
  it("when SAE says no", () => {
    expect(playCard("e3-neu-005", { yes: { sae: false } })).toEqual([
      "ballot shock",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e3-neu-005", { yes: { sae: true } })).toEqual([
      "ballot shock",
      "points:sae:1",
      "mod:lio:-1:min1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
