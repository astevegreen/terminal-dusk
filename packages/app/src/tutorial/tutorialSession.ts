// The tutorial as a game against the AI (#642): the lesson's tutorial match, played as LIO against the Easy AI
// through the same session as every game against the AI. The match is kept beside the session, so the screen can
// show the coaching and the answers the coach allows.
import type { Lesson, TutorialEdition } from "@terminal-dusk/host";
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import type { MakeAi } from "../vsAi/aiOpponent.ts";
import { createVsAiSession } from "../vsAi/session.ts";
import type { VsAiSession } from "../vsAi/session.ts";
import { createTutorialMatch } from "./tutorialMatch.ts";
import type { TutorialMatch } from "./tutorialMatch.ts";

export type TutorialSessionInputs = Readonly<{
  lesson: Lesson;
  edition: TutorialEdition;
  clock: () => number;
  newSeed: () => string;
  newAiSeed: () => number;
  makeAi: MakeAi;
}>;

/** The session, and the tutorial match behind it (null when the match could not be made: the session says why). */
export type TutorialSession = { session: VsAiSession; match: TutorialMatch | null };

export function createTutorialSession(inputs: TutorialSessionInputs): TutorialSession {
  const { lesson, edition, clock, newSeed, newAiSeed, makeAi } = inputs;
  let match: TutorialMatch | null = null;
  const session = createVsAiSession({
    human: "lio",
    gameSeed: newSeed(),
    aiSeed: newAiSeed(),
    clock,
    makeAi,
    tier: "easy",
    ruleset: firstDeckRuleset,
    label: firstDeckCardName,
    makeMatch: (seed, matchClock) => {
      const made = createTutorialMatch(lesson, edition, seed, matchClock);
      if (made.ok) match = made.value;
      return made;
    },
  });
  return { session, match };
}
