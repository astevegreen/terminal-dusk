import { describe, expect, it } from "vitest";
import { lessonSchema, type Lesson } from "../schema/tutorial.ts";
import { TUTORIAL_LESSONS } from "./tutorialLessons.ts";

/** Every piece of text a learner can see in `lesson`: its title, its chapters' titles and its steps' words. */
const shownText = (lesson: Lesson): string[] => [
  lesson.title,
  ...lesson.chapters.flatMap((chapter) => [chapter.title, ...chapter.steps.flatMap((step) => step.say)]),
];

/** Why `lesson` is wrongly marked, or null: a lesson not marked placeholder may not say "Placeholder". */
const placeholderWordError = (lesson: Lesson): string | null =>
  !lesson.placeholder && shownText(lesson).some((text) => /placeholder/i.test(text))
    ? `${lesson.id} is not marked placeholder but says "Placeholder".`
    : null;

describe("the bundled tutorial lessons (#640)", () => {
  it("has the placeholder lesson, marked as one, with the first 16 Era 1 cards on top", () => {
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === "placeholder");
    expect(lesson?.placeholder).toBe(true);
    expect(lesson?.title).toBe("Placeholder lesson");
    expect(lesson?.deckTop).toHaveLength(16);
    expect(lesson?.chapters[0]?.steps[0]?.say).toBe("Placeholder: play any card from your hand.");
  });

  it("no lesson with placeholder: false says Placeholder in its title or text", () => {
    expect(TUTORIAL_LESSONS.map(placeholderWordError).filter((e) => e !== null)).toEqual([]);
  });

  it("the placeholder check catches a lesson that is not marked but says Placeholder", () => {
    const marked = TUTORIAL_LESSONS.find((l) => l.id === "placeholder")!;
    const unmarked = lessonSchema.parse({ ...marked, placeholder: false });
    expect(placeholderWordError(unmarked)).toMatch(/placeholder/);
    const chapterOnly = lessonSchema.parse({
      ...unmarked,
      title: "Your first game",
      chapters: [{ id: "c", title: "A placeholder chapter", steps: [{ when: { start: true }, say: "Hello." }] }],
    });
    expect(placeholderWordError(chapterOnly)).not.toBeNull();
  });
});
