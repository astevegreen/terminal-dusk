// e2-lio-006 Libya Disarms: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-006 Libya Disarms", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-006", {})).toEqual([
      "programme surrendered",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
