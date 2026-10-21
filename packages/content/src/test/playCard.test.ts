// The card test helper's own options: which side plays a neutral card, and the numbers drawn in order.
import type { CardDef } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playCard, playCardDef } from "./playCard.ts";

/** A made-up neutral card that draws twice from the deck of the side that played it. */
const TWO_DRAWS: CardDef = {
  id: "two-draws",
  era: "era-1",
  ops: 2,
  affiliation: "neutral",
  effect: [
    { op: "drawContingency", side: "player" },
    { op: "drawContingency", side: "player" },
  ],
};

describe("playCard: which side plays a neutral card", () => {
  it("plays a neutral card as LIO by default", () => {
    expect(playCard("e1-neu-006")).toEqual([
      "new voice",
      "mod:lio:-1:min1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
    ]);
  });

  it("plays a neutral card as SAE when playedBy says SAE", () => {
    expect(playCardDef(TWO_DRAWS, { draws: [3, 4], playedBy: "sae" })).toEqual([
      "points:lio:2",
      "draw:sae:3",
      "draw:sae:4",
      "points:lio:2",
      "points:sae:2",
    ]);
  });

  it("refuses playedBy on a side's own card", () => {
    expect(() => playCard("e1-lio-004", { yes: { sae: true }, playedBy: "sae" })).toThrow(/only for neutral cards/);
  });
});

describe("playCard: the numbers drawn", () => {
  it("draws the fixed numbers in order", () => {
    expect(playCardDef(TWO_DRAWS, { draws: [5, 2] })).toEqual([
      "draw:lio:5",
      "draw:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });

  it("refuses draw and draws together", () => {
    expect(() => playCard("e1-lio-004", { yes: { sae: true }, draw: 3, draws: [4] })).toThrow(/not both/);
  });

  it("keeps the draw option working", () => {
    expect(playCard("e1-lio-004", { yes: { sae: true }, draw: 4 })).toContain("draw:sae:4");
  });
});
