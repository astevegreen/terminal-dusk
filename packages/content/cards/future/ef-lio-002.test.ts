// ef-lio-002 Undersea Cable Patrols: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-lio-002 Undersea Cable Patrols", () => {
  it("plays out as its text says", () => {
    expect(playCard("ef-lio-002", {})).toEqual([
      "cables watched",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
