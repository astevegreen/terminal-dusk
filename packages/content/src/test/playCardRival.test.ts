// The card test helper's ways for the rival to play the card under test, and its story lines for a hand shown
// and for a discard. Made-up cards only: no real card is played here.
import type { CardDef } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playCardDef } from "./playCard.ts";

const saysWhoPlayed = (rival: "lio" | "sae"): CardDef["effect"][number] => ({
  op: "if",
  cond: { op: "playedBy", side: rival },
  then: [{ op: "marker", label: "byRival" }],
  else: [{ op: "marker", label: "byOwner" }],
});

/** An LIO card of ops 3: its event says who played it, shows SAE's hand, and makes SAE discard 1 card at random. */
const SPY: CardDef = {
  id: "test-spy",
  era: "era-1",
  ops: 3,
  affiliation: "lio",
  effect: [saysWhoPlayed("sae"), { op: "revealHand", side: "sae" }, { op: "discardFromHand", side: "sae", count: 1 }],
};

/** An SAE card of ops 1 whose event only says who played it. */
const SMALL: CardDef = { id: "test-small", era: "era-1", ops: 1, affiliation: "sae", effect: [saysWhoPlayed("lio")] };

describe("playCard: who plays the card under test", () => {
  it("by default, its own side plays it for its event", () => {
    expect(playCardDef(SMALL)).toEqual(["points:lio:2", "byOwner", "points:lio:2", "points:sae:2"]);
  });

  it("rival points: the rival plays it for its points, its event happens, and the story starts there", () => {
    // LIO plays SAE's ops 1 card: the event first, then LIO's points; then the fillers' plays.
    expect(playCardDef(SMALL, { rival: "points" })).toEqual([
      "byRival",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });

  it("rival opening: the rival picks it as its opening card, its event happens, and the story starts there", () => {
    // LIO picks SAE's card as its opening card: its event runs once both picks are in, then the four plays.
    expect(playCardDef(SMALL, { rival: "opening" })).toEqual([
      "byRival",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });
});

describe("playCard: the rival's use together with earlier cards", () => {
  it("rival points and rival opening still tell the last turn's story after a `before` card", () => {
    // e1-neu-006's modifier ends with its own turn, so the last turn's story is the same as with no earlier card.
    for (const rival of ["points", "opening"] as const) {
      expect(playCardDef(SMALL, { rival, before: ["e1-neu-006"] })).toEqual(playCardDef(SMALL, { rival }));
    }
  });
});

describe("playCard: story lines for a shown hand and a discard", () => {
  it("reveal:<side> and discard:<side>:<count>, for each way the card is played", () => {
    expect(playCardDef(SPY)).toEqual([
      "byOwner",
      "reveal:sae",
      "discard:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
    expect(playCardDef(SPY, { rival: "points" })).toEqual([
      "byRival",
      "reveal:sae",
      "discard:sae:1",
      "points:sae:3",
      "points:lio:2",
      "points:sae:2",
    ]);
    expect(playCardDef(SPY, { rival: "opening" })).toEqual([
      "byRival",
      "reveal:sae",
      "discard:sae:1",
      "points:lio:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ]);
  });

  it("no story line names a card from a hand", () => {
    for (const rival of [undefined, "points", "opening"] as const) {
      const lines = playCardDef(SPY, rival === undefined ? {} : { rival }).join(" ");
      expect(lines).not.toMatch(/fill-|test-|deck-/);
    }
  });
});
