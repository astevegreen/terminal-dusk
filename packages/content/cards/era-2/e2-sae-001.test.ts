// e2-sae-001 Invasion of Iraq: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-sae-001 Invasion of Iraq", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-sae-001", {})).toEqual([
      "points:lio:2",
      "coalition fractures",
      "points:sae:2",
      "mod:lio:-1:min1",
      "points:lio:1",
      "points:sae:2",
    ]);
  });
});
