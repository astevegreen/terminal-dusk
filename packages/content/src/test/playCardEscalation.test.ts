// R18a: the card test helper tells Escalation's moves (escalation:<from>:<to>, crisis:<side>:<value>), and its
// `map` option plays the card in a game with the test map, where Escalation is on. Off by default.
import type { CardDef } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playCardDef, story } from "./playCard.ts";

/** A made-up LIO card whose event does nothing: only fillers and the turn's end move anything. */
const FILLER_ONLY: CardDef = { id: "filler-only", era: "era-1", ops: 2, affiliation: "lio", effect: [] };

describe("story: Escalation's events", () => {
  it("tells escalationChanged as escalation:<from>:<to>", () => {
    expect(story([{ kind: "escalationChanged", visibility: "public", from: 2, to: 3 }])).toEqual(["escalation:2:3"]);
  });

  it("tells escalationCrisis as crisis:<side>:<value>", () => {
    expect(story([{ kind: "escalationCrisis", visibility: "public", side: "sae", value: 4 }])).toEqual([
      "crisis:sae:4",
    ]);
  });
});

describe("playCard: the map option", () => {
  it("with map on, a filler-only card's story tells the turn-end fall as escalation:2:1", () => {
    expect(playCardDef(FILLER_ONLY, { map: true })).toEqual([
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "escalation:2:1",
    ]);
  });

  it("with map off (the default), the same play has no escalation line", () => {
    expect(playCardDef(FILLER_ONLY)).toEqual(["points:sae:2", "points:lio:2", "points:sae:2"]);
  });

  it("with map on, a raise in the card's event shows in the story", () => {
    const raises: CardDef = { ...FILLER_ONLY, id: "raises", effect: [{ op: "escalate", by: 1 }] };
    expect(playCardDef(raises, { map: true })).toEqual([
      "escalation:2:3",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "escalation:3:2",
    ]);
  });
});
