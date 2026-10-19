// e3-lio-005 Shale Revolution: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-005 Shale Revolution", () => {
  it("when SAE says no", () => {
    expect(playCard("e3-lio-005", { yes: { sae: false } })).toEqual([
      "energy independence",
      "points:lio:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e3-lio-005", { yes: { sae: true } })).toEqual([
      "energy independence",
      "points:lio:2",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
