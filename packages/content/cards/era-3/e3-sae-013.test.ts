// e3-sae-013 Eurozone Crisis: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-013 Eurozone Crisis", () => {
  it("when LIO says no", () => {
    expect(playCard("e3-sae-013", { yes: { lio: false } })).toEqual([
      "points:lio:2",
      "troika",
      "port sold",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when LIO says yes", () => {
    expect(playCard("e3-sae-013", { yes: { lio: true } })).toEqual([
      "points:lio:2",
      "troika",
      "points:lio:1",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
