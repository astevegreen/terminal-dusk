// The eras' display data (packages/content/eras/): each era's number, its name when it has one, and its years
// (docs/design/eras.md). Shown to players only; the rules know an era by its id.
import { z } from "zod";

const text = z.string().min(1);

const era = z
  .strictObject({
    /** The era id the cards and scenarios use. */
    id: text,
    /** What a player reads where there is a number, such as "Era 1". */
    label: text,
    /** The era's name; the future cards have none. */
    name: text.exactOptional(),
    from: z.int(),
    to: z.int(),
  })
  .refine((e) => e.from < e.to, { path: ["to"], message: "an era ends after it starts" });

export const erasSchema = z.strictObject({
  eras: z
    .array(era)
    .min(1)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((e, i) => {
        if (seen.has(e.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `era "${e.id}" is listed twice` });
        seen.add(e.id);
      });
    }),
});
