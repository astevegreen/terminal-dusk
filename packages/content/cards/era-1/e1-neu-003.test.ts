// e1-neu-003 Ruble Default: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-003 Ruble Default", () => {
  it("when SAE says yes", () => {
    expect(playCard("e1-neu-003", { yes: { sae: true } })).toEqual([
      "default",
      "points:sae:2",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
  it("when SAE says no", () => {
    expect(playCard("e1-neu-003", { yes: { sae: false } })).toEqual([
      "default",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
