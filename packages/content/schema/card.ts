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

/**
 * A rule change a `modifier` step makes. The one hook so far is a card's ops value: for cards whose points
 * `side` (or either side) spends, `add` more (a non-zero whole number), never below `min` (0 or more) if given.
 */
const modifierSpec = z.strictObject({
  hook: z.literal("opsValue"),
  side: z.enum(["lio", "sae", "both"]),
  add: z.int().refine((n) => n !== 0, { error: "A modifier's add must not be 0." }),
  min: wholeNumber.exactOptional(),
});

/** How long a modifier or trigger lasts. The one duration so far: until the end of the turn it was made in. */
const duration = z.strictObject({ kind: z.literal("turnEnd") });

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
  z.strictObject({ op: z.literal("modifier"), mod: modifierSpec, duration }),
  // A reaction that runs each time `hook` happens until the duration ends: at least one step.
  z.strictObject({
    op: z.literal("trigger"),
    hook: z.enum(["cardPlayed", "turnEnd"]),
    do: block.min(1, { error: "A trigger needs at least one step to run." }),
    duration,
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

/**
 * The path to the `side` of every contingency draw in `steps`, at any depth. Only a neutral card is refused
 * these: TEMPORARY until neutral draws are built. An LIO or SAE card may draw from either deck, the rival's
 * included, and from both (docs/design/contingency-deck.md, owner 19 Oct). A missing or invalid side is
 * left to the step's own check.
 */
function drawPaths(steps: readonly Step[], path: (string | number)[]): (string | number)[][] {
  return steps.flatMap((step, i) => {
    const here = [...path, i];
    if (step.op === "drawContingency") return step.side === "lio" || step.side === "sae" ? [[...here, "side"]] : [];
    if (step.op === "if") {
      return [...drawPaths(step.then, [...here, "then"]), ...drawPaths(step.else ?? [], [...here, "else"])];
    }
    if (step.op === "forEach" || step.op === "trigger") return drawPaths(step.do, [...here, "do"]);
    return [];
  });
}

const NEUTRAL_DRAW = "A neutral card can't draw from a Contingency deck: neutral events have no Contingency deck yet.";

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
    if (ctx.value.affiliation !== "neutral") return;
    for (const path of drawPaths(ctx.value.effect, ["effect"])) {
      ctx.issues.push({ code: "custom", input: ctx.value, path, message: NEUTRAL_DRAW });
    }
  });
