// e3-neu-006 Arms Control Unravels: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-neu-006 Arms Control Unravels", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-neu-006", {})).toEqual([
      "treaties lapse",
      "mod:both:+1",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
    ]);
  });
});
