// e2-lio-008 Smartphones and Social Networks: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-008 Smartphones and Social Networks", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-008", {})).toEqual([
      "everyone is connected",
      "points:lio:1",
      "mod:both:+1",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
    ]);
  });
});
