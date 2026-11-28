// Test helper (#700, #701): plays a lesson's real first-deck tutorial game, the learner taking the first answer the
// coaching allows (a card for its points when it may), SAE as `sae` picks; what each frame showed.
import type { Lesson } from "@terminal-dusk/content";
import type { AnswerValue } from "@terminal-dusk/engine";
import { startTutorial, stepTutorial, type TutorialOutput } from "../tutorial/runner.ts";
import type { Frame } from "../types.ts";
import { eventsFirst, learnerFrames, type Picker } from "./tutorialGame.ts";

/** A short name for an answer, for comparing lists of them. */
export const named = (a: AnswerValue): string =>
  [
    a.kind,
    "card" in a ? a.card : "",
    "as" in a ? a.as : "",
    "action" in a ? a.action : "",
    "country" in a ? a.country : "",
    "event" in a ? a.event : "",
  ]
    .filter(Boolean)
    .join(" ");

/** What the learner could answer to one decision, and the step showing then (`chapter/step`). */
export type Showing = { step: string; decision: string; legal: string[]; allowed: string[] };

export type Played = {
  /** Each step's filled text, when it started showing. */
  lines: { step: string; text: string }[];
  asked: Showing[];
  /** The aside shown in each frame, or null, with the step showing then. */
  asides: { step: string | null; aside: string | null }[];
  over: boolean;
};

/**
 * Plays `lesson`. `seen` turns each real frame into the one the runner is given (by default, the frame itself), so a
 * test can show the learner a game state the scripted game does not reach.
 */
export function playLesson(lesson: Lesson, sae: Picker = eventsFirst, seen: (f: Frame) => Frame = (f) => f): Played {
  let runner = startTutorial(lesson);
  let out: TutorialOutput | null = null;
  const played: Played = { lines: [], asked: [], asides: [], over: false };
  const pick: Picker = (side, decision, answers) => {
    if (side !== "lio") return sae(side, decision, answers);
    if (out === null) return eventsFirst(side, decision, answers);
    const allowed = answers.filter(out.allows);
    if (out.style !== null && out.chapter !== null) {
      const step = `${out.chapter.id}/${out.runner.step}`;
      played.asked.push({ step, decision: decision.kind, legal: answers.map(named), allowed: allowed.map(named) });
    }
    return allowed.find((a) => a.kind === "playCardAs" && a.as === "points") ?? allowed[0] ?? answers[0]!;
  };
  for (const frame of learnerFrames(pick, 200, lesson)) {
    out = stepTutorial(runner, seen(frame));
    const step = out.chapter === null ? null : `${out.chapter.id}/${out.runner.step}`;
    const started =
      out.runner.active && (!runner.active || runner.step !== out.runner.step || runner.chapter !== out.runner.chapter);
    if (started) played.lines.push({ step: step!, text: out.coaching! });
    played.asides.push({ step: out.runner.active ? step : null, aside: out.aside });
    runner = out.runner;
    if (out.coachingOver) break;
  }
  played.over = out?.coachingOver ?? false;
  return played;
}
