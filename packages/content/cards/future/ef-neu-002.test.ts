// ef-neu-002 Heat Dome Summer: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-neu-002 Heat Dome Summer", () => {
  it("plays out as its text says", () => {
    expect(playCard("ef-neu-002", {})).toEqual([
      "record heat",
      "mod:both:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
