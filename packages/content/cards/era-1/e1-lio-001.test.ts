// e1-lio-001 Maastricht Treaty: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-001 Maastricht Treaty", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-lio-001", {})).toEqual([
      "union founded",
      "points:lio:1",
      "mod:lio:+1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
    ]);
  });
});
