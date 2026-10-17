// The card schema: what one card file in packages/content/cards/ must hold (docs/architecture.md, section 4).
// It accepts only what the engine can run; card.types.test.ts checks it against the engine's types.
import type { Step } from "@terminal-dusk/engine";
import * as z from "zod";

/** A step a card's effect may hold: any engine step but a card choice, which only a turn's opening asks for. */
export type CardStep = Exclude<Step, { decision: { kind: "chooseCard" } }>;

const side = z.enum(["lio", "sae"]);
const name = z.string().min(1);
const wholeNumber = z.int().min(0);

/** A list of steps. Lazy, because a step may hold lists of steps (stepSchema, below). */
const block = z.array(z.lazy((): z.ZodType<CardStep, CardStep> => stepSchema));

/** A yes/no question, to one side or both at once. Never a card choice: that is only a turn's opening. */
const choose = z.strictObject({
  op: z.literal("choose"),
  who: z.enum(["lio", "sae", "both"]),
  decision: z.strictObject({
    kind: z.literal("yesNo", { error: "A card's effect may only ask yes/no; only a turn's opening picks a card." }),
  }),
  bind: name,
});
const condition = z.strictObject({ op: z.literal("yes"), var: name, side: side.exactOptional() });

/** One step of a card's effect. Every kind of engine step but a card choice, at any depth. */
export const stepSchema = z.discriminatedUnion("op", [
  choose,
  z.strictObject({ op: z.literal("if"), cond: condition, then: block, else: block.exactOptional() }),
  z.strictObject({ op: z.literal("forEach"), over: z.array(z.string()), bind: name, do: block }),
  z.strictObject({ op: z.literal("marker"), label: z.string(), var: name.exactOptional() }),
  z.strictObject({ op: z.literal("spendPoints"), side, amount: wholeNumber }),
  z.strictObject({ op: z.literal("drawContingency"), side, bind: name.exactOptional() }),
]);

/** What a platform changes about a card's text: its wording or art, never its rules. At least one of them. */
const variant = z
  .strictObject({ name: name.exactOptional(), rules: name.exactOptional(), art: name.exactOptional() })
  .refine((v) => Object.keys(v).length > 0, { error: "A variant must change at least one of name, rules or art." });

/** A card's text: name, rules text, history note and art, with optional changes for each platform. */
const text = z.strictObject({
  name,
  rules: name,
  history: name,
  art: name,
  variants: z.partialRecord(z.enum(["web", "steam", "ios", "android"]), variant).exactOptional(),
});

/** One card file. `flags` are not allowed yet: they arrive with the rules that use them. */
export const cardSchema = z.strictObject({
  id: name,
  era: name,
  ops: wholeNumber,
  affiliation: z.enum(["lio", "sae", "neutral"]),
  effect: block,
  text,
});
