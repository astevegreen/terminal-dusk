// e3-lio-003 Ghost Stories: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-003 Ghost Stories", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-lio-003", { yes: { lio: false } })).toEqual([
      "sleepers exposed",
      "points:lio:2",
      "no exchange",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-lio-003", { yes: { lio: true } })).toEqual([
      "sleepers exposed",
      "points:lio:2",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
