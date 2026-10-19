// e1-lio-008 GPS Signal Opened: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-008 GPS Signal Opened", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-lio-008", {})).toEqual([
      "signal opened",
      "mod:lio:+1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
    ]);
  });
});
