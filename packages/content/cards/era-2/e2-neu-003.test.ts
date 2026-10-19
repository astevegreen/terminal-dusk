// e2-neu-003 SARS: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-003 SARS", () => {
  it("when LIO says no and SAE says no", () => {
    expect(playCard("e2-neu-003", { yes: { lio: false, sae: false } })).toEqual([
      "outbreak",
      "mod:lio:+1",
      "triggerSet:turnEnd",
      "mod:sae:+1",
      "triggerSet:turnEnd",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
      "triggerFired:turnEnd",
      "triggerFired:turnEnd",
      "points:sae:2",
      "points:lio:2",
    ]);
  });
  it("when LIO says no and SAE says yes", () => {
    expect(playCard("e2-neu-003", { yes: { lio: false, sae: true } })).toEqual([
      "outbreak",
      "mod:lio:+1",
      "triggerSet:turnEnd",
      "points:sae:1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ]);
  });
  it("when LIO says yes and SAE says no", () => {
    expect(playCard("e2-neu-003", { yes: { lio: true, sae: false } })).toEqual([
      "outbreak",
      "points:lio:1",
      "mod:sae:+1",
      "triggerSet:turnEnd",
      "points:sae:3",
      "points:lio:2",
      "points:sae:3",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
  it("when LIO says yes and SAE says yes", () => {
    expect(playCard("e2-neu-003", { yes: { lio: true, sae: true } })).toEqual([
      "outbreak",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
