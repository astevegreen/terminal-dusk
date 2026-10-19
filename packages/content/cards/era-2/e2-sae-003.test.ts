// e2-sae-003 Olympic Summer 2008: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-003 Olympic Summer 2008", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-003", {})).toEqual([
      "points:lio:2",
      "summer of 2008",
      "points:sae:3",
      "mod:sae:+1",
      "points:lio:2",
      "points:sae:3",
    ]);
  });
});
