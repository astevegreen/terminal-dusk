// The card test helper's `before` option (#202): real cards played for their events in earlier turns of the same
// game, so a card under test can read a lasting tag they recorded. The story still starts with the card under test.
import { describe, expect, it } from "vitest";
import { playCard } from "./test/playCard.ts";

describe("playCard with cards played before the card under test", () => {
  it("plays the earlier card in its own turn, so its turn-end effects stay out of the story", () => {
    // Battle of Mogadishu sets a turn-end trigger; none of it shows in Kosovo's story.
    expect(playCard("e2-neu-007", { before: ["e1-sae-001"] })).toEqual(playCard("e2-neu-007"));
  });

  it("lets the card under test read a lasting tag the earlier card recorded", () => {
    expect(playCard("e1-neu-001", { before: ["e1-sae-001"] }).slice(0, 3)).toEqual([
      "the world looks away",
      "mod:lio:-2:min1",
      "mod:sae:-1:min1",
    ]);
  });

  it("plays several earlier cards, one per turn, each with its own answers", () => {
    const story = playCard("e1-neu-001", {
      before: [{ card: "e1-lio-002", yes: { sae: false } }, "e1-sae-001"],
    });
    expect(story.slice(0, 3)).toEqual(["the world looks away", "mod:lio:-2:min1", "mod:sae:-1:min1"]);
    expect(story).not.toContain("lasting:hollow assurance");
  });

  it("refuses an earlier card that is the card under test", () => {
    expect(() => playCard("e1-sae-001", { before: ["e1-sae-001"] })).toThrow(/before itself/);
  });

  it("without earlier cards, a card that reads a tag plays as if the tag was never recorded", () => {
    expect(playCard("e1-neu-001").slice(0, 2)).toEqual(["the world looks away", "mod:both:-1:min1"]);
  });
});
