// e1-sae-010 Hainan Island Incident: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-010 Hainan Island Incident", () => {
  it("when LIO says yes", () => {
    expect(playCard("e1-sae-010", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "collision",
      "points:sae:1",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says no", () => {
    expect(playCard("e1-sae-010", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "collision",
      "points:sae:1",
      "mod:lio:+1",
      "points:sae:1",
      "points:lio:3",
      "points:sae:2",
    ]);
  });
});
