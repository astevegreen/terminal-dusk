// e3-lio-009 Nordic Accession: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e3-lio-009 Nordic Accession", () => {
  it("plays out as its text says", () => {
    expect(playCard("e3-lio-009", {})).toEqual([
      "Baltic lake",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
