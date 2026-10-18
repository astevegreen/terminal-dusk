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
const condition = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("yes"), var: name, side: side.exactOptional() }),
  z.strictObject({ op: z.enum(["atLeast", "atMost", "equals"]), var: name, value: z.int() }),
]);

/** One step of a card's effect. Every kind of engine step but a card choice, at any depth. */
export const stepSchema = z.discriminatedUnion("op", [
  choose,
  z.strictObject({ op: z.literal("if"), cond: condition, then: block, else: block.exactOptional() }),
  z.strictObject({ op: z.literal("forEach"), over: z.array(z.string()), bind: name, do: block }),
  z.strictObject({ op: z.literal("marker"), label: z.string(), var: name.exactOptional() }),
  z.strictObject({ op: z.literal("spendPoints"), side, amount: wholeNumber }),
  z.strictObject({ op: z.literal("drawContingency"), side, bind: name.exactOptional() }),
  z.strictObject({
    op: z.literal("addToNumber"),
    var: name,
    amount: z.int().refine((n) => n !== 0, { error: "An addToNumber amount must not be 0." }),
  }),
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

const SIDE_NAMES = { lio: "LIO", sae: "SAE" } as const;

/**
 * Every contingency draw in `steps`, at any depth, that this card may not make: the path to its `side`
 * and the message. A side's card draws only from its own deck. A neutral card may not draw at all:
 * TEMPORARY until neutral events are designed. A missing or invalid side is left to the step's own check.
 */
function foreignDraws(
  steps: readonly Step[],
  affiliation: "lio" | "sae" | "neutral",
  path: (string | number)[],
): { path: (string | number)[]; message: string }[] {
  return steps.flatMap((step, i) => {
    const here = [...path, i];
    if (step.op === "drawContingency") {
      if (step.side !== "lio" && step.side !== "sae") return [];
      if (step.side === affiliation) return [];
      const message =
        affiliation === "neutral"
          ? "A neutral card can't draw from a Contingency deck: neutral events have no Contingency deck yet."
          : `This is an ${SIDE_NAMES[affiliation]} card, so its event can only draw from ${SIDE_NAMES[affiliation]}'s Contingency deck, not ${SIDE_NAMES[step.side]}'s.`;
      return [{ path: [...here, "side"], message }];
    }
    if (step.op === "if") {
      return [
        ...foreignDraws(step.then, affiliation, [...here, "then"]),
        ...foreignDraws(step.else ?? [], affiliation, [...here, "else"]),
      ];
    }
    if (step.op === "forEach") return foreignDraws(step.do, affiliation, [...here, "do"]);
    return [];
  });
}

/** One card file. `flags` are not allowed yet: they arrive with the rules that use them. */
export const cardSchema = z
  .strictObject({
    id: name,
    era: name,
    ops: wholeNumber,
    affiliation: z.enum(["lio", "sae", "neutral"]),
    effect: block,
    text,
  })
  .check((ctx) => {
    for (const found of foreignDraws(ctx.value.effect, ctx.value.affiliation, ["effect"])) {
      ctx.issues.push({ code: "custom", input: ctx.value, path: found.path, message: found.message });
    }
  });
