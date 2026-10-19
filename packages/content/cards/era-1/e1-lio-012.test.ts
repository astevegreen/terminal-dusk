// e1-lio-012 Partnership for Peace: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-012 Partnership for Peace", () => {
  it("when SAE says yes", () => {
    expect(playCard("e1-lio-012", { yes: { sae: true } })).toEqual([
      "partners, not members",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says no", () => {
    expect(playCard("e1-lio-012", { yes: { sae: false } })).toEqual([
      "partners, not members",
      "points:lio:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
