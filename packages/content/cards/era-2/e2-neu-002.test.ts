// e2-neu-002 September 11: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-neu-002 September 11", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-neu-002", {})).toEqual([
      "shock",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
