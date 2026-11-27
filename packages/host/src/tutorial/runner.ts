// The tutorial runner (#639): follows a lesson's chapters from the learner's frames, never GameState (hard rule 2).
// Pure: the same runner and frame always give the same output, and neither input is changed.
import type { Lesson } from "@terminal-dusk/content";
import type { AnswerValue, Ruleset } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "../firstDeck.ts";
import type { Frame } from "../types.ts";
import { fillLine, fillText, type Filled } from "./fill.ts";
import { allowed, triggerMatches, type Step } from "./matching.ts";

/**
 * Where the learner is in the lesson, as plain JSON: the chapter and step indexes, whether that step is showing,
 * and whether the coaching has ended. `ruleset` holds the card data a line's slots need; `filled` is the showing
 * step's variant and text, filled once when it started showing and kept for the rest of the step (#699).
 */
export type TutorialRunner = {
  lesson: Lesson;
  ruleset: Ruleset;
  chapter: number;
  step: number;
  active: boolean;
  filled: Filled | null;
  coachingOver: boolean;
};

export type TutorialOutput = {
  runner: TutorialRunner;
  /** What the coach says in this frame, its slots filled from the live game, or null. */
  coaching: string | null;
  /**
   * A lesson aside whose event is in this frame, before the chapter it names: its filled text, or null. It never
   * limits answers and does not move the chapter steps on.
   */
  aside: string | null;
  /** The chapter being taught, or null once the coaching is over. */
  chapter: { id: string; title: string } | null;
  /** The showing step's style, or null when nothing shows. */
  style: Step["style"] | null;
  /** Whether the learner may send `answer` to this frame's decision. */
  allows: (answer: AnswerValue) => boolean;
  /** True once the last chapter's last step has ended, or the game is over; the match goes on without coaching. */
  coachingOver: boolean;
};

/** The tutorial always plays the first deck, so its ruleset is the default; a frame from another ruleset throws. */
export function startTutorial(lesson: Lesson, ruleset: Ruleset = firstDeckRuleset): TutorialRunner {
  return { lesson, ruleset, chapter: 0, step: 0, active: false, filled: null, coachingOver: false };
}

/** The step after the current one, through the chapters; coachingOver after the last. */
function advance(r: TutorialRunner): TutorialRunner {
  const steps = r.lesson.chapters[r.chapter]!.steps;
  if (r.step + 1 < steps.length) return { ...r, step: r.step + 1, active: false, filled: null };
  if (r.chapter + 1 < r.lesson.chapters.length) {
    return { ...r, chapter: r.chapter + 1, step: 0, active: false, filled: null };
  }
  return { ...r, active: false, filled: null, coachingOver: true };
}

const over = (r: TutorialRunner): TutorialOutput => ({
  runner: r.coachingOver ? r : { ...r, active: false, filled: null, coachingOver: true },
  coaching: null,
  aside: null,
  chapter: null,
  style: null,
  allows: () => true,
  coachingOver: true,
});

/** The first aside whose event is in `frame` while its named chapter has not started, filled; or null. */
function asideFor(r: TutorialRunner, frame: Frame): string | null {
  const ids = r.lesson.chapters.map((c) => c.id);
  const aside = (r.lesson.asides ?? []).find((a) => r.chapter < ids.indexOf(a.before) && triggerMatches(a.when, frame));
  return aside === undefined ? null : fillText(aside.say, frame, r.ruleset);
}

/**
 * Moves the lesson on by one frame. A showing step ends when its `until` is in a later frame, or, with no `until`,
 * after the one frame it showed in. Then, in the same frame, the next step shows when its `when` is in it.
 */
export function stepTutorial(runner: TutorialRunner, frame: Frame): TutorialOutput {
  let r = runner;
  if (r.coachingOver || frame.view.public.status.kind !== "active") return over(r);
  if (r.active) {
    const until = r.lesson.chapters[r.chapter]!.steps[r.step]!.until;
    if (until === undefined || triggerMatches(until, frame)) r = advance(r);
    if (r.coachingOver) return over(r);
  }
  const chapter = r.lesson.chapters[r.chapter]!;
  const step = chapter.steps[r.step]!;
  if (!r.active && triggerMatches(step.when, frame)) {
    r = { ...r, active: true, filled: fillLine(step, frame, r.ruleset) };
  }
  const showing = r.active ? step : null;
  const allow = showing?.style === "coach" ? (r.filled?.allow ?? showing.allow) : undefined;
  const decision = frame.decision;
  return {
    runner: r,
    coaching: r.active ? (r.filled?.text ?? null) : null,
    aside: asideFor(r, frame),
    chapter: { id: chapter.id, title: chapter.title },
    style: showing?.style ?? null,
    allows: (answer) => allow === undefined || allowed(allow, answer, decision, frame),
    coachingOver: false,
  };
}
