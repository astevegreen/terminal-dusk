// e3-lio-008 Pre-bunking: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-008 Pre-bunking", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-lio-008", {})).toEqual([
      "pretext denied",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
