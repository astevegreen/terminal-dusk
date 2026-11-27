// The real tutorial lesson's chapters 1-4 (#700), played through a real first-deck tutorial game: the learner follows
// the coaching, SAE plays as the test helper does. It checks the answers each step allows and that each line's slots
// fill from the live frame.
import { TUTORIAL_LESSONS, type Lesson } from "@terminal-dusk/content";
import type { AnswerValue } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventsFirst, learnerFrames, type Picker } from "../test/tutorialGame.ts";
import { startTutorial, stepTutorial, type TutorialOutput } from "./runner.ts";

const lesson = TUTORIAL_LESSONS.find((l) => l.id === "first-game") as Lesson;

/** A short name for an answer, for comparing lists of them. */
const named = (a: AnswerValue): string =>
  [
    a.kind,
    "card" in a ? a.card : "",
    "as" in a ? a.as : "",
    "action" in a ? a.action : "",
    "country" in a ? a.country : "",
  ]
    .filter(Boolean)
    .join(" ");

type Showing = { step: string; decision: string; legal: string[]; allowed: string[] };

/** Plays the lesson's game, the learner taking the first answer the coaching allows; what each frame showed. */
function playThrough() {
  let runner = startTutorial(lesson);
  let out: TutorialOutput | null = null;
  const lines: { step: string; text: string }[] = [];
  const asked: Showing[] = [];
  const pick: Picker = (side, decision, answers) => {
    if (side !== "lio" || out === null) return eventsFirst(side, decision, answers);
    const allowed = answers.filter(out.allows);
    if (out.style !== null && out.chapter !== null) {
      const step = `${out.chapter.id}/${out.runner.step}`;
      asked.push({ step, decision: decision.kind, legal: answers.map(named), allowed: allowed.map(named) });
    }
    return allowed.find((a) => a.kind === "playCardAs" && a.as === "points") ?? allowed[0] ?? answers[0]!;
  };
  for (const frame of learnerFrames(pick, 200, lesson)) {
    out = stepTutorial(runner, frame);
    const started =
      out.runner.active && (!runner.active || runner.step !== out.runner.step || runner.chapter !== out.runner.chapter);
    if (started) lines.push({ step: `${out.chapter!.id}/${out.runner.step}`, text: out.coaching! });
    runner = out.runner;
    if (out.coachingOver) break;
  }
  return { lines, asked, over: out?.coachingOver ?? false };
}

const game = playThrough();

describe("the first-game lesson, played through chapters 1-4", () => {
  it("shows every step of the four chapters, in order, then ends its coaching", () => {
    expect(game.lines.map((l) => l.step)).toEqual([
      "opening/0",
      "opening/1",
      "opening/2",
      "influence/0",
      "influence/1",
      "rival-cards/0",
      "rival-cards/1",
      "intervene/0",
      "intervene/1",
      "intervene/2",
      "intervene/3",
    ]);
    expect(game.over).toBe(true);
  });

  it("fills each line's slots from the live frame", () => {
    for (const { text } of game.lines) expect(text).not.toMatch(/[{}]/);
    const text = (step: string) => game.lines.find((l) => l.step === step)!.text;
    expect(text("opening/2")).toMatch(
      /^Maastricht gives you 1 point now\. You can place where you already have influence \(Taiwan\), next to it, or next to the United States \(Mexico, Cuba, Canada\)\./,
    );
    expect(text("influence/0")).toContain("so 4 to spend.");
    expect(text("rival-cards/1")).toContain("gives 1 point. After: you spend 2, and the penalty");
    expect(text("intervene/1")).toContain("Play Desert Storm Coalition for its 4 points");
    expect(text("intervene/2")).toContain(
      "With 4 points, a stability-2 country such as Crimea gives a result equal to your draw.",
    );
  });
});

describe("the answers each step allows", () => {
  /** What the learner could answer at the first `decision` asked while `step` showed. */
  const at = (step: string, decision: string): Showing => {
    const found = game.asked.find((a) => a.step === step && a.decision === decision);
    if (found === undefined) throw new Error(`No ${decision} while ${step} showed.`);
    return found;
  };

  it("chapters 1-4 name the card to play, from a hand that holds others", () => {
    for (const [step, decision, card] of [
      ["opening/0", "chooseCard", "chooseCard e1-lio-001"],
      ["influence/0", "playCardAs", "playCardAs e1-lio-004 points"],
      ["rival-cards/0", "playCardAs", "playCardAs e1-sae-008 points"],
      ["intervene/0", "chooseCard", "chooseCard e1-lio-012"],
      ["intervene/1", "playCardAs", "playCardAs e1-lio-006 points"],
    ] as const) {
      const shown = at(step, decision);
      expect(shown.allowed, step).toEqual([card]);
      expect(shown.legal.length, step).toBeGreaterThan(1);
    }
  });

  it("chapters 1-3 allow placing only, and chapter 4 intervening only", () => {
    for (const step of ["opening/2", "influence/0", "rival-cards/1"]) {
      const shown = at(step, "chooseAction");
      expect(shown.allowed, step).toEqual(["chooseAction place"]);
      expect(shown.legal.length, step).toBeGreaterThan(1);
    }
    const intervene = at("intervene/2", "chooseAction");
    expect(intervene.allowed.length).toBeGreaterThan(0);
    for (const answer of intervene.allowed) expect(answer).toMatch(/^chooseAction intervene\b/);
    expect(intervene.legal.some((a) => !a.startsWith("chooseAction intervene"))).toBe(true);
  });

  it("the turn 2 opening pick is a coached step inside chapter 4", () => {
    expect(lesson.chapters[3]!.steps[0]).toMatchObject({
      when: { decision: "chooseCard", side: "lio", turn: 2 },
      style: "coach",
    });
  });
});
