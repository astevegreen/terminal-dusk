// e1-lio-006 Desert Storm Coalition: one test for each way its effect can play out.
import { describe, expect, it } from "vitest";
import { playCard } from "../../src/test/playCard.ts";

describe("e1-lio-006 Desert Storm Coalition", () => {
  it("plays out as its text says", () => {
    expect(playCard("e1-lio-006", {})).toEqual([
      "coalition victory",
      "points:lio:3",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
    ]);
  });
});
