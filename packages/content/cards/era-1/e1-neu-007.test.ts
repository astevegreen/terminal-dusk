// e1-neu-007 First Crew on the ISS: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-007 First Crew on the ISS", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-neu-007", {})).toEqual([
      "crew aboard",
      "mod:both:+1",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
    ]);
  });
});
