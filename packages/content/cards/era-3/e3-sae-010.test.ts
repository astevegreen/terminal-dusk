// e3-sae-010 Fall of Kabul: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-sae-010 Fall of Kabul", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-sae-010", {})).toEqual([
      "points:lio:2",
      "resolve questioned",
      "points:sae:1",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
