// e1-neu-004 Test Ban Treaty: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-004 Test Ban Treaty", () => {
  it("when LIO says yes and SAE says yes", () => {
    expect(playCard("e1-neu-004", { yes: { lio: true, sae: true } })).toEqual([
      "treaty in force",
      "points:lio:2",
      "points:sae:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and SAE says no", () => {
    expect(playCard("e1-neu-004", { yes: { lio: true, sae: false } })).toEqual([
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says no and SAE says yes", () => {
    expect(playCard("e1-neu-004", { yes: { lio: false, sae: true } })).toEqual([
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says no and SAE says no", () => {
    expect(playCard("e1-neu-004", { yes: { lio: false, sae: false } })).toEqual([
      "treaty stalled",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
