// The sound manifest (packages/app/public/sounds/manifest.json): every sound file the app ships, where it came from,
// and the owner's approval of it (docs/workflow.md, assets). An id with no entry is silent.
import { z } from "zod";

const text = z.string().min(1);

const sound = z.strictObject({
  /** The sound id the app asks for (the app's SOUND_IDS; its test checks the two match). */
  id: text,
  /** The file's name in the sounds folder: no folders, no addresses. */
  file: text
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "a plain file name in the sounds folder")
    .refine((name) => name !== "manifest.json", "the manifest is not a sound"),
  /** The library or address the file came from. */
  source: text,
  /** The owner's words: "CC0, you approve". */
  licence: z.enum(["CC0"]),
  author: text.exactOptional(),
  /** The day the file was fetched, year-month-day. */
  retrieved: z.iso.date(),
  /** The stores ask whether assets were AI-generated. */
  aiGenerated: z.boolean(),
  ownerApproved: z.literal(true),
});

export const soundManifestSchema = z.strictObject({
  sounds: z.array(sound).superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `sound "${s.id}" is listed twice` });
      seen.add(s.id);
    });
  }),
});

export type SoundManifest = z.infer<typeof soundManifestSchema>;
