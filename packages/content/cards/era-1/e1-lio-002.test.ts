// e1-lio-002 Budapest Memorandum: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-002 Budapest Memorandum", () => {
  it("when SAE says yes", () => {
    expect(playCard("e1-lio-002", { yes: { sae: true } })).toEqual([
      "assurances given",
      "points:lio:2",
      "promise kept",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE says no", () => {
    expect(playCard("e1-lio-002", { yes: { sae: false } })).toEqual([
      "assurances given",
      "points:lio:2",
      "hollow assurance",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
