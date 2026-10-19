// e2-sae-012 Abu Ghraib: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-012 Abu Ghraib", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-012", {})).toEqual([
      "points:lio:2",
      "credibility hit",
      "points:sae:1",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
