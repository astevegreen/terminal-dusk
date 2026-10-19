// e1-neu-001 Rwandan Genocide: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-001 Rwandan Genocide", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-neu-001", {})).toEqual([
      "the world looks away",
      "mod:both:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ]);
  });
});
