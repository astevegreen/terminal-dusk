// e3-neu-002 COVID-19: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-002 COVID-19", () => {
  it("when LIO says no and SAE says no", () => {
    expect(playCard("e3-neu-002", { yes: { lio: false, sae: false } })).toEqual([
      "pandemic",
      "points:lio:2",
      "points:sae:1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says no and SAE says yes", () => {
    expect(playCard("e3-neu-002", { yes: { lio: false, sae: true } })).toEqual([
      "pandemic",
      "points:lio:2",
      "points:sae:1",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
  it("when LIO says yes and SAE says no", () => {
    expect(playCard("e3-neu-002", { yes: { lio: true, sae: false } })).toEqual([
      "pandemic",
      "points:lio:1",
      "mod:lio:-1:min1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes and SAE says yes", () => {
    expect(playCard("e3-neu-002", { yes: { lio: true, sae: true } })).toEqual([
      "pandemic",
      "points:lio:1",
      "mod:lio:-1:min1",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
