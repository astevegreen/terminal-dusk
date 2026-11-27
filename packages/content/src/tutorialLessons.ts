// The bundled tutorial lessons, one JSON file each in tutorial/ (#640). A new lesson file must be added here too.
// Each file is parsed with the lesson schema when this module loads, so a lesson
// that breaks it fails at once, not only in content:check.
import { lessonSchema, type Lesson } from "../schema/tutorial.ts";
import firstGame from "../tutorial/first-game.json" with { type: "json" };
import placeholder from "../tutorial/placeholder.json" with { type: "json" };

/**
 * Every bundled lesson. The placeholder stays first, so the app keeps playing it until the real lesson, "first-game"
 * (chapters 1-4 so far, #700), is finished in #701.
 */
export const TUTORIAL_LESSONS: readonly Lesson[] = [lessonSchema.parse(placeholder), lessonSchema.parse(firstGame)];
