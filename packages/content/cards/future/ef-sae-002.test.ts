// ef-sae-002 Cable Cut in the Baltic: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-sae-002 Cable Cut in the Baltic", () => {
  it("plays out as its text says", () => {
    expect(playCard("ef-sae-002", {})).toEqual([
      "points:lio:2",
      "anchor dragged",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
