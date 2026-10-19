// e1-lio-013 Oslo Accords: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-013 Oslo Accords", () => {
  it("when SAE says yes", () => {
    expect(playCard("e1-lio-013", { yes: { sae: true } })).toEqual([
      "handshake",
      "points:lio:1",
      "points:sae:1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ]);
  });
  it("when SAE says no", () => {
    expect(playCard("e1-lio-013", { yes: { sae: false } })).toEqual([
      "handshake",
      "points:lio:1",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
