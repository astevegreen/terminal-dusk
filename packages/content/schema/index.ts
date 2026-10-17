// Content schemas, one per content folder of this package (cards/ is checked by schemas.cards, and so on).
// `pnpm content:check` validates every JSON file under packages/content/<folder>/ with schemas[<folder>].
// A folder with no schema here is rejected until its schema is written.
import { cardSchema } from "./card.ts";

/** One problem found in a content file: where (a path into the JSON) and what is wrong. */
export type ContentIssue = { readonly path: readonly PropertyKey[]; readonly message: string };

/** What content:check needs from a schema. Zod schemas already have this shape. */
export type ContentSchema = {
  safeParse(data: unknown): { success: true } | { success: false; error: { issues: readonly ContentIssue[] } };
};

export const schemas: Readonly<Record<string, ContentSchema>> = { cards: cardSchema };
