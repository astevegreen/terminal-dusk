// e1-sae-008 Primakov's U-turn: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-008 Primakov's U-turn", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-sae-008", {})).toEqual([
      "points:lio:2",
      "turn over the Atlantic",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
