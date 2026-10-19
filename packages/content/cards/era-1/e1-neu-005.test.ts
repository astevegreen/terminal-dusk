// e1-neu-005 Pokhran and Chagai: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-005 Pokhran and Chagai", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-neu-005", {})).toEqual([
      "two new nuclear states",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
