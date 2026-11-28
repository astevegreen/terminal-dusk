// Every bundled tutorial lesson plays to the end (#640): the learner (LIO) sends only answers the runner allows, the
// Easy AI plays SAE with a fixed AI seed, and the coaching ends before the game does. A few games per lesson and
// edition, not FUZZ_GAMES: each is a whole game on the six-region map.
import { easyAnswer, EASY_WEIGHTS, seededRandom } from "@terminal-dusk/ai";
import { TUTORIAL_LESSONS, type Lesson } from "@terminal-dusk/content";
import { legalAnswers } from "@terminal-dusk/engine";
import type { AnswerValue } from "@terminal-dusk/engine";
import { hostCreate, hostSubmit, startTutorial, stepTutorial, tutorialConfig } from "@terminal-dusk/host";
import type { HostResult, TutorialEdition } from "@terminal-dusk/host";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { MAX_ANSWERS } from "./play.ts";

const SEEDS = ["tutorial-1", "tutorial-2", "tutorial-3"];
const EDITIONS: readonly TutorialEdition[] = ["full", "free"];
/** The AI's own seed, the same in every game, so a failure plays again exactly. */
const AI_SEED = 640;
/** A whole six-region game takes well under a second; this leaves room for a loaded machine. */
const TIME_LIMIT = Math.max(60_000, SEEDS.length * EDITIONS.length * TUTORIAL_LESSONS.length * 5_000);

/** `shown` holds each step that showed, as "chapter/step"; `lines`, every coaching text the learner saw. */
type Outcome = {
  coachingOverTurn: number | null;
  finalTurn: number;
  stuck: string[];
  shown: Set<string>;
  lines: Set<string>;
};

function unwrap(r: ReturnType<typeof hostCreate>): HostResult {
  if (!r.ok) throw new Error(`host refused: ${r.error.code} ${r.error.message ?? ""}`);
  return r.value;
}

/** Plays `lesson` in `edition` from `seed` to game over, the learner picking among the answers the runner allows. */
function playLesson(lesson: Lesson, edition: TutorialEdition, seed: string): Outcome {
  const random = seededRandom(AI_SEED);
  let host = unwrap(hostCreate(firstDeckRuleset, tutorialConfig(lesson, edition), seed, 0));
  let runner = startTutorial(lesson);
  let output = stepTutorial(runner, host.frames.lio);
  const outcome: Outcome = { coachingOverTurn: null, finalTurn: 0, stuck: [], shown: new Set(), lines: new Set() };
  for (let n = 0; n < MAX_ANSWERS && host.record.status.kind === "active"; n++) {
    runner = output.runner;
    if (output.coaching !== null && output.chapter !== null) {
      outcome.shown.add(`${output.chapter.id}/${runner.step}`);
      outcome.lines.add(output.coaching);
    }
    if (output.coachingOver && outcome.coachingOverTurn === null)
      outcome.coachingOverTurn = host.frames.lio.view.public.turn;
    const lio = host.frames.lio.decision;
    const side = lio !== null ? "lio" : "sae";
    const frame = host.frames[side];
    const decision = frame.decision;
    if (decision === null) throw new Error("no side has a decision while the game is active");
    let value: AnswerValue | null;
    if (side === "lio") {
      const legal = legalAnswers(firstDeckRuleset, host.secret.state, "lio");
      const allowed = legal.filter((a) => output.allows(a));
      if (allowed.length === 0) outcome.stuck.push(`${decision.kind} at seq ${frame.seq}`);
      value = (allowed.length > 0 ? allowed : legal)[Math.floor(random() * (allowed.length || legal.length))]!;
    } else {
      value = easyAnswer(firstDeckRuleset, frame.view, "sae", EASY_WEIGHTS, random);
    }
    if (value === null) throw new Error(`no answer for ${side}'s ${decision.kind}`);
    const player = host.record.players[side];
    host = unwrap(
      hostSubmit(
        firstDeckRuleset,
        host.record,
        host.secret,
        { player, expectedSeq: host.record.seq, decisionId: decision.id, value },
        0,
      ),
    );
    output = stepTutorial(runner, host.frames.lio);
  }
  expect(host.record.status.kind, "the game ends").toBe("over");
  expect(output.coachingOver, "no coaching once the game is over").toBe(true);
  outcome.finalTurn = host.frames.lio.view.public.turn;
  return outcome;
}

describe("every bundled tutorial lesson plays to the end (#640)", () => {
  for (const lesson of TUTORIAL_LESSONS) {
    for (const edition of EDITIONS) {
      it(
        `${lesson.id}, ${edition} edition: every step allows a legal answer, the coaching ends, then the game ends`,
        () => {
          for (const seed of SEEDS) {
            const outcome = playLesson(lesson, edition, seed);
            expect(outcome.stuck, `seed ${seed}: a step allowed no legal answer`).toEqual([]);
            // A step's words are filled from the live game (#699), so each step is named by chapter and index.
            const steps = lesson.chapters.flatMap((chapter) => chapter.steps.map((_, i) => `${chapter.id}/${i}`));
            expect([...outcome.shown].toSorted(), `seed ${seed}: every step's words show`).toEqual(steps.toSorted());
            const unfilled = [...outcome.lines].filter((line) => /[{}]/.test(line));
            expect(unfilled, `seed ${seed}: every slot is filled`).toEqual([]);
            // A step that says several lines shows them joined by a blank line (#701).
            const written = lesson.chapters.flatMap((c) =>
              c.steps.filter((st) => !st.variants).map((st) => [st.say].flat().join("\n\n")),
            );
            for (const text of written.filter((t) => !/[{}]/.test(t)))
              expect(outcome.lines, `seed ${seed}: a line with no slots shows as written`).toContain(text);
            expect(outcome.coachingOverTurn, `seed ${seed}: the coaching ends before the game`).not.toBeNull();
            if (edition === "free") expect(outcome.finalTurn, `seed ${seed}: a free game ends on turn 3`).toBe(3);
            else expect(outcome.finalTurn, `seed ${seed}: a full game goes past turn 3`).toBeGreaterThan(3);
          }
        },
        TIME_LIMIT,
      );
    }
  }
});
