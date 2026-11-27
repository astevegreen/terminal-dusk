// The tutorial match (#641): a local match on the first deck, set up by the lesson, with the tutorial runner
// following the learner's (LIO's) frames. A coach step's limits are kept here: an answer the step does not allow is
// refused before it reaches the host, so the game does not change. Everything else passes straight through.
import type { Lesson } from "@terminal-dusk/host";
import type { AnswerValue, Seed, Viewer } from "@terminal-dusk/engine";
import { neverStuck, startTutorial, stepTutorial, tutorialConfig } from "@terminal-dusk/host";
import type { HostError, TutorialEdition } from "@terminal-dusk/host";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { createLocalMatch, type ArchiveWith, type LocalMatch } from "../transport/localMatch.ts";
import type { MatchTransport, SubmitResult } from "../transport/matchTransport.ts";

/** What the coach shows now: its words, the chapter's title, the step's style, its limits, and whether it is over. */
export type TutorialCoaching = {
  text: string | null;
  chapter: string | null;
  style: "coach" | "hint" | null;
  allows: (answer: AnswerValue) => boolean;
  over: boolean;
};

export type TutorialMatch = LocalMatch & {
  coaching(): TutorialCoaching;
  /** Calls `listener` each time the coaching moves on to a new frame; the returned function stops it. */
  subscribeCoaching(listener: () => void): () => void;
};

/** The learner's side: the lesson is always played as LIO. */
const LEARNER = "lio";
const notInLesson: SubmitResult = { ok: false, error: { code: "notInLesson" } };

export function createTutorialMatch(
  lesson: Lesson,
  edition: TutorialEdition,
  seed: Seed,
  clock: () => number,
  archiveWith?: ArchiveWith,
): { ok: true; value: TutorialMatch } | { ok: false; error: HostError } {
  const made = createLocalMatch(firstDeckRuleset, tutorialConfig(lesson, edition), seed, clock, archiveWith);
  if (!made.ok) return made;
  const inner = made.value;
  let runner = startTutorial(lesson);
  let steppedSeq = -1;
  let coaching: TutorialCoaching = { text: null, chapter: null, style: null, allows: () => true, over: false };
  const listeners = new Set<() => void>();

  // Subscribed before any screen, so the coaching has moved on before a screen sees the same frame.
  inner.transportFor(LEARNER).subscribe((frame) => {
    if (frame.seq <= steppedSeq) return;
    steppedSeq = frame.seq;
    let output = stepTutorial(runner, frame);
    runner = output.runner;
    if (output.style === "coach") output = neverStuck(output, inner.legalAnswers(LEARNER));
    coaching = {
      text: output.coaching,
      chapter: output.chapter?.title ?? null,
      style: output.style,
      allows: output.allows,
      over: output.coachingOver,
    };
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A listener's own failure; the coaching and the other listeners carry on.
      }
    }
  });

  const transportFor = (viewer: Viewer): MatchTransport => {
    const transport = inner.transportFor(viewer);
    if (viewer !== LEARNER) return transport;
    return {
      ...transport,
      submit(s) {
        // Only an answer to the frame the coaching is on is checked; a stale one goes on to the host, which refuses it.
        if (s.expectedSeq === steppedSeq && !coaching.allows(s.value)) return Promise.resolve(notInLesson);
        return transport.submit(s);
      },
    };
  };

  return {
    ok: true,
    value: {
      ...inner,
      transportFor,
      coaching: () => coaching,
      subscribeCoaching(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
}
