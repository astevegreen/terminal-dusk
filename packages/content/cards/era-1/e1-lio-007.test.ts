// e1-lio-007 Kosovo Air Campaign: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-007 Kosovo Air Campaign", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-lio-007", {})).toEqual([
      "intervention without mandate",
      "points:lio:2",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
