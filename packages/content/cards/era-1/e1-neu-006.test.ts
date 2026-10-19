// e1-neu-006 Al Jazeera Launches: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-neu-006 Al Jazeera Launches", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-neu-006", {})).toEqual([
      "new voice",
      "mod:lio:-1:min1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
