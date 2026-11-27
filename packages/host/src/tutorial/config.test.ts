import { TUTORIAL_LESSONS } from "@terminal-dusk/content";
import { describe, expect, it } from "vitest";
import { era1FreeConfig, firstDeckRuleset, sixRegionMapConfig } from "../firstDeck.ts";
import { hostCreate } from "../hostCreate.ts";
import { deepFreeze } from "../test/deepFreeze.ts";
import { tutorialConfig } from "./config.ts";

const lesson = TUTORIAL_LESSONS[0]!;

describe("tutorialConfig (#640)", () => {
  it("the full edition is the six-region game with the lesson's first cards on top of the draw pile", () => {
    const { setup } = tutorialConfig(lesson, "full");
    const { deckTop, ...rest } = setup;
    expect(rest).toEqual(sixRegionMapConfig().setup);
    expect(deckTop).toEqual(lesson.deckTop);
  });

  it("the free edition plays the free game's numbers on the six-region map", () => {
    const { setup } = tutorialConfig(lesson, "free");
    const free = era1FreeConfig().setup;
    expect(setup.turns).toBe(free.turns);
    expect(setup.turns).toBe(3);
    expect(setup.eras).toEqual(free.eras);
    expect(setup.playsPerTurn).toBe(free.playsPerTurn);
    expect(setup.handSize).toBe(free.handSize);
    expect(setup.abilities).toEqual(free.abilities);
    expect(setup.map).toEqual(sixRegionMapConfig().setup.map);
    expect(setup.deckTop).toEqual(lesson.deckTop);
  });

  it("deals the learner the lesson's first cards, whatever the seed", () => {
    for (const edition of ["full", "free"] as const) {
      for (const seed of ["a", "b"]) {
        const r = hostCreate(firstDeckRuleset, tutorialConfig(lesson, edition), seed, 0);
        if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
        const dealt = [...r.value.secret.state.private.lio.hand, ...r.value.secret.state.private.sae.hand];
        expect(dealt.toSorted()).toEqual(lesson.deckTop.toSorted());
      }
    }
  });

  it("shares nothing with the lesson and leaves it unchanged", () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(lesson)) as typeof lesson);
    const config = tutorialConfig(frozen, "full");
    expect(config.setup.deckTop).not.toBe(frozen.deckTop);
    expect(config.matchId).toBe(`tutorial-${lesson.id}`);
  });
});
