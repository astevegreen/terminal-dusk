// ef-sae-001 Shadow Fleet: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("ef-sae-001 Shadow Fleet", () => {
  it("when SAE draws 1", () => {
    expect(playCard("ef-sae-001", { draw: 1 })).toEqual([
      "points:lio:2",
      "draw:sae:1",
      "tanker seized",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
  it("when SAE draws 3", () => {
    expect(playCard("ef-sae-001", { draw: 3 })).toEqual([
      "points:lio:2",
      "draw:sae:3",
      "sanctions evaded",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});
