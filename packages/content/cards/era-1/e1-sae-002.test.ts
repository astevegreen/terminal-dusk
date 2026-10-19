// e1-sae-002 Handover of Hong Kong: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-sae-002 Handover of Hong Kong", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-sae-002", {})).toEqual([
      "points:lio:2",
      "one country, two systems",
      "points:sae:3",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
