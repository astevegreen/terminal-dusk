// The tutorial screen (#642): the lesson's game against the Easy AI, played as LIO on the same game view as every
// game against the AI, with the coach's words drawn over it. A guest opens it with no sign-in and no entitlement:
// it starts the free edition for everyone until #647 picks the edition. When the coaching ends the game goes on as
// a normal game, and its end is the usual end of a game against the AI.
import { TUTORIAL_LESSONS } from "@terminal-dusk/host";
import type { Lesson, TutorialEdition } from "@terminal-dusk/host";
import {
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckCardRules,
  firstDeckRuleset,
} from "@terminal-dusk/host/first-deck";
import type { CardId } from "@terminal-dusk/engine";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { pointsOf } from "../displayText.ts";
import type { MakeAi } from "../vsAi/aiOpponent.ts";
import { openSession, VsAiView } from "../vsAi/VsAiScreen.tsx";
import type { VsAiSession } from "../vsAi/session.ts";
import { createWorkerAi } from "../vsAi/workerAi.ts";
import { CoachingPanel } from "./CoachingPanel.tsx";
import type { TutorialCoaching, TutorialMatch } from "./tutorialMatch.ts";
import { createTutorialSession } from "./tutorialSession.ts";
import type { TutorialSession } from "./tutorialSession.ts";
import "./tutorial.css";

/** Shown while the lesson is a placeholder, so nobody takes it for the real lesson. */
export const PLACEHOLDER_LABEL = "Placeholder lesson";
/** The panel's line once the coaching has ended (Decision (architect) on #642). */
export const COACHING_OVER = "Placeholder: coaching is over; the game goes on.";
const points = pointsOf(firstDeckRuleset);
const affiliation = (id: CardId) => firstDeckRuleset.cards.find((card) => card.id === id)?.affiliation;
const NO_COACHING: TutorialCoaching = { text: null, chapter: null, style: null, allows: () => true, over: false };

/** The coach's corner: the placeholder label while the lesson is one, then the chapter and words, or the end line. */
export function TutorialCoach({ lesson, coaching }: Readonly<{ lesson: Lesson; coaching: TutorialCoaching }>) {
  return (
    <div className="tutorial-coach">
      {lesson.placeholder && <p className="tutorial-label">{PLACEHOLDER_LABEL}</p>}
      {coaching.over ? (
        <CoachingPanel text={COACHING_OVER} chapter={null} style="hint" />
      ) : (
        <CoachingPanel text={coaching.text} chapter={coaching.chapter} style={coaching.style} />
      )}
    </div>
  );
}

const noMatch = {
  subscribeCoaching: () => () => {},
  coaching: () => NO_COACHING,
};

function TutorialGame({
  lesson,
  started,
  onNewGame,
}: Readonly<{ lesson: Lesson; started: TutorialSession; onNewGame: () => void }>) {
  const { session } = started;
  const match: Pick<TutorialMatch, "coaching" | "subscribeCoaching"> = started.match ?? noMatch;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const coaching = useSyncExternalStore(match.subscribeCoaching, match.coaching, match.coaching);
  return (
    <VsAiView
      snapshot={snapshot}
      session={session}
      onNewGame={onNewGame}
      note={lesson.title}
      label={firstDeckCardName}
      question={firstDeckCardQuestion}
      affiliation={affiliation}
      rules={firstDeckCardRules}
      points={points}
      allows={coaching.allows}
      coach={<TutorialCoach lesson={lesson} coaching={coaching} />}
    />
  );
}

export type TutorialScreenProps = {
  clock: () => number;
  newSeed: () => string;
  newAiSeed: () => number;
  /** The AI opponent; the Web Worker one when left out. */
  makeAi?: MakeAi;
  /** The lesson; the first bundled one when left out. */
  lesson?: Lesson;
  /** Which edition's game the lesson sets up; the free one for everyone for now (#647 picks it). */
  edition?: TutorialEdition;
};

/** Starts one lesson's session when it mounts and stops it (and so the AI) when it goes. */
function Playing({
  start,
  lesson,
  onNewGame,
}: Readonly<{ start: () => TutorialSession; lesson: Lesson; onNewGame: () => void }>) {
  const [started, setStarted] = useState<TutorialSession | null>(null);
  useEffect(() => {
    let current: TutorialSession | null = null;
    return openSession(
      (): VsAiSession => {
        current = start();
        return current.session;
      },
      () => setStarted(current),
    );
  }, [start]);
  return started ? <TutorialGame lesson={lesson} started={started} onNewGame={onNewGame} /> : null;
}

export function TutorialScreen({
  clock,
  newSeed,
  newAiSeed,
  makeAi = createWorkerAi,
  lesson = TUTORIAL_LESSONS[0]!,
  edition = "free",
}: Readonly<TutorialScreenProps>) {
  // New game starts the lesson again from its first chapter.
  const [game, setGame] = useState(0);
  const start = useCallback(
    () => createTutorialSession({ lesson, edition, clock, newSeed, newAiSeed, makeAi }),
    [lesson, edition, clock, newSeed, newAiSeed, makeAi],
  );
  return <Playing key={game} start={start} lesson={lesson} onNewGame={() => setGame((n) => n + 1)} />;
}
