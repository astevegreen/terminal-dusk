// e3-neu-003 Paris Agreement: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-003 Paris Agreement", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-neu-003", { yes: { lio: false } })).toEqual([
      "pledges",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-neu-003", { yes: { lio: true } })).toEqual([
      "pledges",
      "points:lio:1",
      "mod:lio:-1:min1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
