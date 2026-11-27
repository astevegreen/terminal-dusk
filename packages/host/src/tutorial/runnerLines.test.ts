// The runner's live lines (#699): a step's variant and its own allow, filled once when the step starts showing, and
// lesson asides. Frames come from a real first-deck tutorial game (test/tutorialGame.ts), so the slots can be filled.
import { lessonSchema, type Lesson } from "@terminal-dusk/content";
import type { AnswerValue, GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "../test/deepFreeze.ts";
import { inForce, learnerFrames, learnerFrameWhere } from "../test/tutorialGame.ts";
import type { Frame } from "../types.ts";
import { startTutorial, stepTutorial, type TutorialRunner } from "./runner.ts";

/** The game's first frame. */
const start = deepFreeze(learnerFrames().next().value!);
/** A frame where LIO plays a card for event or points, with nothing in force. */
const plainPlay = deepFreeze(
  learnerFrameWhere((f) => f.decision?.kind === "playCardAs" && f.view.public.modifiers.length === 0),
);
/** A frame where LIO plays a card for event or points, with Maastricht's +1 for LIO in force. */
const maastrichtPlay = deepFreeze(
  learnerFrameWhere((f) => inForce(f, "e1-lio-001") && f.decision?.kind === "playCardAs"),
);
const placed: GameEvent = { kind: "influencePlaced", visibility: "public", side: "lio", country: "france", cost: 1 };
const scored: GameEvent = { kind: "scoreChanged", visibility: "public", from: 0, to: 1 };
const withEvents = (f: Frame, events: GameEvent[]): Frame => ({ ...f, events });
/** A card in LIO's hand in `f`. */
const inHand = (f: Frame): string => f.view.mine!.hand[0]!;

const lesson = (card: string): Lesson =>
  lessonSchema.parse({
    id: "lesson-lines",
    title: "Live lines",
    placeholder: true,
    deckTop: [],
    chapters: [
      {
        id: "ch1",
        title: "Opening",
        steps: [
          {
            when: { decision: "playCardAs", side: "lio" },
            say: "Play it for its points. The tech race costs {techRaceCost:lio}.",
            allow: [{ kind: "playCardAs", card, as: "points" }],
            variants: [
              {
                if: [{ kind: "modifierInForce", card: "e1-lio-001" }],
                say: "With Maastricht in force, play it for its event.",
                allow: [{ kind: "playCardAs", card, as: "event" }],
              },
            ],
            until: { event: "influencePlaced", side: "lio" },
          },
        ],
      },
      { id: "ch2", title: "Placing", steps: [{ when: { decision: "placeInfluence" }, say: "Place." }] },
    ],
    asides: [
      { when: { event: "scoreChanged" }, before: "ch2", say: "A point! The tech race costs {techRaceCost:lio}." },
    ],
  });

/** Runs the frames in order, returning every output. */
const run = (frames: Frame[], runner: TutorialRunner) =>
  frames.map((f) => {
    const out = stepTutorial(runner, f);
    runner = out.runner;
    return out;
  });
const play = (card: string, as: "event" | "points"): AnswerValue => ({ kind: "playCardAs", card, as });

describe("a step's variant", () => {
  it("uses the step's own words and allow when no variant's conditions hold", () => {
    const card = inHand(plainPlay);
    const [out] = run([plainPlay], startTutorial(lesson(card)));
    expect(out!.coaching).toBe("Play it for its points. The tech race costs 1.");
    expect(out!.allows(play(card, "points"))).toBe(true);
    expect(out!.allows(play(card, "event"))).toBe(false);
  });

  it("uses the variant's words and its own allow, which accepts what the step's allow refused, and the reverse", () => {
    const card = inHand(maastrichtPlay);
    const [out] = run([maastrichtPlay], startTutorial(lesson(card)));
    expect(out!.coaching).toBe("With Maastricht in force, play it for its event.");
    expect(out!.runner.filled?.variant).toBe(0);
    expect(out!.allows(play(card, "event"))).toBe(true);
    expect(out!.allows(play(card, "points"))).toBe(false);
  });

  it("is chosen and filled once, when the step starts showing, and kept for the rest of the step", () => {
    const card = inHand(plainPlay);
    const later = { ...plainPlay, view: maastrichtPlay.view };
    const outs = run([plainPlay, later], startTutorial(lesson(card)));
    expect(outs[1]!.coaching).toBe("Play it for its points. The tech race costs 1.");
    expect(outs[1]!.allows(play(card, "points"))).toBe(true);
  });
});

describe("a lesson's aside", () => {
  it("shows, filled from the live game, when its event is in the frame before its chapter, beside a coach step", () => {
    const card = inHand(plainPlay);
    const outs = run([start, withEvents(plainPlay, [scored])], startTutorial(lesson(card)));
    expect(outs[0]!.aside).toBeNull();
    expect(outs[1]!.aside).toBe("A point! The tech race costs 1.");
    expect(outs[1]!.coaching).toBe("Play it for its points. The tech race costs 1.");
  });

  it("does not show once its chapter has started", () => {
    const card = inHand(plainPlay);
    const outs = run(
      [plainPlay, withEvents(start, [placed]), withEvents(start, [scored])],
      startTutorial(lesson(card)),
    );
    expect(outs[1]!.chapter).toEqual({ id: "ch2", title: "Placing" });
    expect(outs[2]!.aside).toBeNull();
  });
});
