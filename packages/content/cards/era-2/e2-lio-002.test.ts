// e2-lio-002 Article 5 Invoked: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e2-lio-002 Article 5 Invoked", () => {
  it("plays out as its text says", () => {
    expect(playCard("e2-lio-002", {})).toEqual([
      "allies rally",
      "points:lio:1",
      "mod:lio:+1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
    ]);
  });
});
