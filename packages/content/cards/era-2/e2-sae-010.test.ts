// e2-sae-010 Peace Mission 2005: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-010 Peace Mission 2005", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-010", {})).toEqual([
      "points:lio:2",
      "joint exercise",
      "points:sae:2",
      "mod:sae:+1",
      "points:lio:2",
      "points:sae:3",
    ]);
  });
});
