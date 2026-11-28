// The runner's steps for chapters 5-7 (#701; Decision (architect) on #701): a step that shows several approved lines
// together, an allow that names the rival event's order, and an aside kept until a later chapter's first step shows
// (owner, 27 Nov 2026, in chat). Frames come from a real first-deck tutorial game (test/tutorialGame.ts).
import { lessonSchema, type Lesson } from "@terminal-dusk/content";
import type { AnswerValue, GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "../test/deepFreeze.ts";
import { learnerFrames, learnerFrameWhere, racingLio } from "../test/tutorialGame.ts";
import type { Frame } from "../types.ts";
import { startTutorial, stepTutorial, type TutorialRunner } from "./runner.ts";

const start = deepFreeze(learnerFrames().next().value!);
const order = deepFreeze(learnerFrameWhere((f) => f.decision?.kind === "rivalEventOrder", racingLio));
const redraw: GameEvent = { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "lio", setAside: 1 };
const placed: GameEvent = { kind: "influencePlaced", visibility: "public", side: "lio", country: "france", cost: 1 };
const withEvents = (f: Frame, events: GameEvent[]): Frame => ({ ...f, events });

const lesson: Lesson = lessonSchema.parse({
  id: "lesson-steps",
  title: "Steps",
  placeholder: true,
  deckTop: [],
  chapters: [
    {
      id: "ch1",
      title: "Two lines",
      steps: [
        {
          when: { start: true },
          say: ["First line.", "The tech race costs {techRaceCost:lio}."],
          until: { event: "influencePlaced", side: "lio" },
        },
        { when: { event: "influencePlaced", side: "lio" }, say: "Second step." },
      ],
    },
    {
      id: "ch2",
      title: "Order",
      steps: [
        { when: { decision: "rivalEventOrder" }, say: "After.", allow: [{ kind: "rivalEventOrder", event: "after" }] },
      ],
    },
    { id: "ch3", title: "Last", steps: [{ when: { start: true }, say: "Last." }] },
  ],
  asides: [{ when: { event: "abilityRedraw", side: "lio" }, before: "ch3", say: "Redrawn." }],
});

const run = (frames: Frame[], runner: TutorialRunner = startTutorial(lesson)) =>
  frames.map((f) => {
    const out = stepTutorial(runner, f);
    runner = out.runner;
    return out;
  });

describe("a step that says several lines", () => {
  it("shows every line, each filled, together in one frame", () => {
    const [out] = run([start]);
    expect(out!.coaching).toBe("First line.\n\nThe tech race costs 1.");
  });
});

describe("an allow that names the rival event's order", () => {
  it("lets the learner put the event after the points, and not before", () => {
    const [, , out] = run([start, withEvents(start, [placed]), order]);
    expect(out!.chapter?.id).toBe("ch2");
    const answer = (event: "before" | "after") => ({ kind: "rivalEventOrder", event }) as AnswerValue;
    expect(out!.allows(answer("after"))).toBe(true);
    expect(out!.allows(answer("before"))).toBe(false);
  });
});

describe("an aside", () => {
  it("stays from its event until the first step of a later chapter shows", () => {
    const outs = run([withEvents(start, [redraw]), start, withEvents(start, [placed]), order]);
    expect(outs.map((o) => o.aside)).toEqual(["Redrawn.", "Redrawn.", "Redrawn.", null]);
  });

  it("never shows once its chapter has started", () => {
    const outs = run([start, withEvents(start, [placed]), order, withEvents(start, [redraw])]);
    expect(outs[3]!.chapter?.id).toBe("ch3");
    expect(outs[3]!.aside).toBeNull();
  });
});
