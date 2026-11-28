// The bundled tutorial lessons, one JSON file each in tutorial/ (#640). A new lesson file must be added here too.
// Each file is parsed with the lesson schema when this module loads, so a lesson
// that breaks it fails at once, not only in content:check.
import { lessonSchema, type Lesson } from "../schema/tutorial.ts";
import firstGame from "../tutorial/first-game.json" with { type: "json" };
import placeholder from "../tutorial/placeholder.json" with { type: "json" };

/** Every bundled lesson. The real lesson, "first-game", is first, so the app plays it (#701). */
export const TUTORIAL_LESSONS: readonly Lesson[] = [lessonSchema.parse(firstGame), lessonSchema.parse(placeholder)];
