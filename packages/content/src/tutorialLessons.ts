// The bundled tutorial lessons, one JSON file each in tutorial/ (#640). A new lesson file must be added here too.
// Each file is parsed with the lesson schema when this module loads, so a lesson
// that breaks it fails at once, not only in content:check.
import { lessonSchema, type Lesson } from "../schema/tutorial.ts";
import placeholder from "../tutorial/placeholder.json" with { type: "json" };

/** Every bundled lesson, in file order. Only the placeholder so far: the real lesson waits on live fill-in. */
export const TUTORIAL_LESSONS: readonly Lesson[] = [lessonSchema.parse(placeholder)];
