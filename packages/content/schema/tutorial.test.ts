import { describe, expect, it } from "vitest";
import { schemas } from "./index.ts";
import { LAST_TUTORIAL_TURN, SAY_MAX, lessonSchema } from "./tutorial.ts";

const lesson = {
  id: "lesson-1",
  title: "Your first game",
  placeholder: true,
  deckTop: ["e1-lio-001", "e1-sae-001"],
  chapters: [
    {
      id: "ch1",
      title: "Opening",
      steps: [
        { when: { start: true }, say: "Welcome.", until: { decision: "chooseCard", side: "lio", turn: 1 } },
        {
          when: { decision: "playCardAs", side: "lio", turn: 1 },
          say: "Play this card for its points.",
          allow: [{ kind: "playCardAs", card: "e1-lio-001", as: "points" }],
          until: { event: "influencePlaced", side: "lio" },
        },
        { when: { event: "scoreChanged" }, say: "Points!", style: "hint" },
        {
          when: { decision: "chooseAction" },
          say: "Place influence.",
          allow: [
            { kind: "chooseAction", action: "place" },
            { kind: "placeInfluence", country: "anywhere" },
          ],
        },
      ],
    },
  ],
};
type Step = Record<string, unknown>;
/** The lesson with its first chapter's first step replaced by `step`. */
const withStep = (step: Step) => ({
  ...lesson,
  chapters: [{ ...lesson.chapters[0], steps: [step] }],
});
const fails = (data: unknown) => !lessonSchema.safeParse(data).success;

describe("tutorial lesson schema", () => {
  it("accepts a valid lesson and makes a step a coach step by default", () => {
    const parsed = lessonSchema.parse(lesson);
    expect(parsed.chapters[0]!.steps.map((s) => s.style)).toEqual(["coach", "coach", "hint", "coach"]);
  });
  it("accepts an empty deckTop", () => {
    expect(lessonSchema.safeParse({ ...lesson, deckTop: [] }).success).toBe(true);
  });
  it("is the schema content:check uses for packages/content/tutorial/", () => {
    expect(schemas.tutorial).toBe(lessonSchema);
  });
  it("makes content:check fail on a bad lesson file", () => {
    expect(schemas.tutorial!.safeParse({ ...lesson, chapters: [] }).success).toBe(false);
  });

  it("needs at least one chapter, and at least one step in each", () => {
    expect(fails({ ...lesson, chapters: [] })).toBe(true);
    expect(fails({ ...lesson, chapters: [{ id: "c", title: "C", steps: [] }] })).toBe(true);
  });
  it("needs id, title, placeholder and deckTop, and refuses fields it does not know", () => {
    for (const key of ["id", "title", "placeholder", "deckTop"]) {
      const rest: Record<string, unknown> = { ...lesson };
      delete rest[key];
      expect(fails(rest), key).toBe(true);
    }
    expect(fails({ ...lesson, scenario: "base-game" })).toBe(true);
    expect(fails({ ...lesson, playerSide: "lio" })).toBe(true);
  });

  it("refuses an unknown Decision or event kind", () => {
    expect(fails(withStep({ when: { decision: "pickSomething" }, say: "x" }))).toBe(true);
    expect(fails(withStep({ when: { event: "somethingHappened" }, say: "x" }))).toBe(true);
    expect(fails(withStep({ when: { start: true }, say: "x", until: { event: "nope" } }))).toBe(true);
  });
  it("refuses a trigger that mixes a Decision and an event, or a start that is not true", () => {
    expect(fails(withStep({ when: { decision: "chooseCard", event: "cardDrawn" }, say: "x" }))).toBe(true);
    expect(fails(withStep({ when: { start: false }, say: "x" }))).toBe(true);
    expect(fails(withStep({ when: { decision: "chooseCard", side: "usa" }, say: "x" }))).toBe(true);
  });

  it(`keeps every step's turn from 1 to ${LAST_TUTORIAL_TURN}, inside Era 1`, () => {
    for (const t of [1, 2, 3]) {
      expect(fails(withStep({ when: { decision: "chooseCard", turn: t }, say: "x" })), `turn ${t}`).toBe(false);
    }
    for (const t of [0, 4, 1.5]) {
      expect(fails(withStep({ when: { decision: "chooseCard", turn: t }, say: "x" })), `turn ${t}`).toBe(true);
      expect(fails(withStep({ when: { start: true }, say: "x", until: { event: "cardDrawn", turn: t } }))).toBe(true);
    }
  });

  it("allows only Era 1 cards in allow and deckTop", () => {
    expect(fails({ ...lesson, deckTop: ["e2-lio-001"] })).toBe(true);
    const step = { when: { decision: "playCardAs" }, say: "x", allow: [{ kind: "playCardAs", card: "e3-sae-001" }] };
    expect(fails(withStep(step))).toBe(true);
  });
  it("refuses a deckTop that repeats a card", () => {
    const r = lessonSchema.safeParse({ ...lesson, deckTop: ["e1-lio-001", "e1-sae-001", "e1-lio-001"] });
    expect(r.success ? [] : r.error.issues.map((i) => i.path)).toEqual([["deckTop", 2]]);
  });

  it("refuses a hint step with allow", () => {
    const step = { when: { decision: "chooseCard" }, say: "x", style: "hint", allow: [{ kind: "chooseCard" }] };
    const r = lessonSchema.safeParse(withStep(step));
    expect(r.success ? [] : r.error.issues.map((i) => i.path.at(-1))).toEqual(["allow"]);
  });
  it("refuses an unknown answer kind, play use or points action in a matcher, or an empty allow", () => {
    const allow = (m: unknown[]) => withStep({ when: { decision: "chooseAction" }, say: "x", allow: m });
    expect(fails(allow([{ kind: "chooseAction", action: "place" }]))).toBe(false);
    expect(fails(allow([{ kind: "shout" }]))).toBe(true);
    expect(fails(allow([{ kind: "playCardAs", as: "both" }]))).toBe(true);
    expect(fails(allow([{ kind: "chooseAction", action: "coup" }]))).toBe(true);
    expect(fails(allow([{ kind: "chooseAction", region: "europe" }]))).toBe(true);
    expect(fails(allow([]))).toBe(true);
  });

  it(`caps what a step says at ${SAY_MAX} characters and needs some text`, () => {
    expect(fails(withStep({ when: { start: true }, say: "a".repeat(SAY_MAX) }))).toBe(false);
    expect(fails(withStep({ when: { start: true }, say: "a".repeat(SAY_MAX + 1) }))).toBe(true);
    expect(fails(withStep({ when: { start: true }, say: "" }))).toBe(true);
  });
});
