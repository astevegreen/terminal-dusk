// The game's final frame (#701): a free game ends at Era 1's scoring, so the scoring step's event arrives on the
// "over" frame. The owner chose "Show it at game end": the step waiting for that frame shows there, and the coaching
// ends in the same frame.
import { lessonSchema, type Lesson } from "@terminal-dusk/content";
import type { AnswerValue, GameEvent, PlayerView } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { firstDeckRuleset } from "../firstDeck.ts";
import { deepFreeze } from "../test/deepFreeze.ts";
import type { Frame } from "../types.ts";
import { startTutorial, stepTutorial, type TutorialOutput } from "./runner.ts";

const scored: GameEvent = { kind: "regionScored", visibility: "public", region: "europe", lio: 2, sae: 1 };
const placed: GameEvent = { kind: "influencePlaced", visibility: "public", side: "lio", country: "france", cost: 1 };
const moved: GameEvent = { kind: "scoreChanged", visibility: "public", from: 0, to: 1 };

const frame = (events: GameEvent[] = [], over = false): Frame => ({
  matchId: "m",
  seq: 1,
  viewer: "lio",
  ruleset: firstDeckRuleset.id,
  view: {
    public: { turn: 3, status: over ? { kind: "over", winner: "lio", reason: "score" } : { kind: "active" } },
    mine: { hand: [], picks: [], knowledge: [] },
  } as unknown as PlayerView,
  events,
  decision: null,
});

/** "Placed." is a hint that shows until the score moves; then the scoring step waits for Era 1's scoring. */
const lesson: Lesson = lessonSchema.parse({
  id: "lesson-final",
  title: "Final frame",
  placeholder: true,
  deckTop: [],
  chapters: [
    {
      id: "ch1",
      title: "Opening",
      steps: [
        { when: { start: true }, say: "Welcome." },
        { when: { event: "influencePlaced" }, say: "Placed.", style: "hint", until: { event: "scoreChanged" } },
      ],
    },
    {
      id: "scoring",
      title: "Scoring",
      steps: [
        { when: { event: "regionScored" }, say: ["Era 1 scores.", "That's all."], until: { event: "scoreChanged" } },
      ],
    },
  ],
  asides: [{ before: "scoring", when: { event: "influencePlaced" }, say: "An aside." }],
});

const run = (frames: Frame[]): TutorialOutput[] => {
  let runner = startTutorial(lesson);
  return frames.map((f) => {
    const out = stepTutorial(runner, deepFreeze(f));
    runner = out.runner;
    return out;
  });
};
const anything = { kind: "pass" } as unknown as AnswerValue;
/** Frames that bring the lesson to its scoring step, waiting. */
const toScoring = [frame(), frame([placed]), frame([moved])];
const SCORING = "Era 1 scores.\n\nThat's all.";

describe("the game's final frame (#701, owner: show chapter 7 at game end)", () => {
  it("shows the waiting step whose event is in the final frame, and ends the coaching in that frame", () => {
    const final = run([...toScoring, frame([scored], true)])[3]!;
    expect(final).toMatchObject({
      coaching: SCORING,
      chapter: { id: "scoring", title: "Scoring" },
      style: "coach",
      aside: null,
      coachingOver: true,
    });
    expect(final.runner.coachingOver).toBe(true);
    expect(final.allows(anything)).toBe(true);
  });

  it("ends a showing step whose until is in the final frame, then shows the next step there", () => {
    const outs = run([frame(), frame([placed]), frame([moved, scored], true)]);
    expect(outs[1]!.coaching).toBe("Placed.");
    expect(outs[2]).toMatchObject({ coaching: SCORING, coachingOver: true });
  });

  it("shows nothing when a step still showing does not end in the final frame", () => {
    const final = run([frame(), frame([placed]), frame([scored], true)])[2]!;
    expect(final).toMatchObject({ coaching: null, chapter: null, style: null, coachingOver: true });
  });

  it("shows nothing on a final frame the waiting step's event is not in", () => {
    const final = run([...toScoring, frame([placed], true)])[3]!;
    expect(final).toMatchObject({ coaching: null, chapter: null, style: null, aside: null, coachingOver: true });
  });

  it("shows the line once: a frame after the final one gives no coaching", () => {
    const outs = run([...toScoring, frame([scored], true), frame([scored], true)]);
    expect(outs[4]).toMatchObject({ coaching: null, chapter: null, coachingOver: true });
  });

  it("drops a showing aside on the final frame", () => {
    const outs = run([frame([placed]), frame(), frame([scored], true)]);
    expect(outs[1]!.aside).toBe("An aside.");
    expect(outs[2]!.aside).toBeNull();
  });
});
