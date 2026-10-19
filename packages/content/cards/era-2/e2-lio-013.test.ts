// e2-lio-013 India-US Nuclear Deal: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-013 India-US Nuclear Deal", () => {
  it("when SAE says no", () => {
    expect(playCard("e2-lio-013", { yes: { sae: false } })).toEqual([
      "new partner",
      "points:lio:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says yes", () => {
    expect(playCard("e2-lio-013", { yes: { sae: true } })).toEqual([
      "new partner",
      "points:lio:2",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
