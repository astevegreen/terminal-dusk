// ef-neu-001 Open-Weight Model Leak: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-neu-001 Open-Weight Model Leak", () => {
  it("plays out as its text says", () => {
    expect(playCard("ef-neu-001", {})).toEqual([
      "weights everywhere",
      "mod:both:+1",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
    ]);
  });
});
