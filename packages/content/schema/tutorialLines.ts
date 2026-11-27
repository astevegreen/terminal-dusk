// What a tutorial coaching line can say beyond fixed words (#698; docs/design/tutorial.md, "Coaching words"): named
// slots for the live numbers and places a line quotes, and the conditions that choose a line's variant. The host
// (#699) picks a step's variant and fills its slots once, when the step starts showing, and keeps them for the rest of
// that step. Both this schema's check and the host's filler read a line with splitLine, so they agree on its slots.
import * as z from "zod";
import { ERA_1_CARDS } from "../src/era1Files.ts";

/** The longest coaching text a step, variant or aside may say, in characters: a few short sentences. */
export const SAY_MAX = 700;

const ERA_1_IDS: ReadonlySet<string> = new Set(ERA_1_CARDS.map((card) => card.id));
export const era1Card = z
  .string()
  .min(1)
  .refine((id) => ERA_1_IDS.has(id), { message: "Only Era 1 cards can be named in a lesson." });
export const side = z.enum(["lio", "sae"]);

/**
 * Every slot a line may name, with what its argument names. A slot about a card names that card, since the card may
 * not be played yet when the line shows.
 * - cardPoints: the points the card gives played for points now (chapters 2, 4, 5 and 6).
 * - pointsBefore, pointsAfter: the points of a play with the named rival card's event before it, or after (chapter 3).
 * - modifierTakesOff: what the named card's modifier in force takes off spends (chapter 3, Rwandan Genocide).
 * - techRaceCost: the cost of the tech race step the side would try (chapter 6).
 * - eventPoints: the points the named rival card's event gives its side to spend (chapter 6).
 * - influenceIn: the countries where the side has influence, in map order (chapter 1's "(Taiwan)").
 * - homeNeighbours: the countries next to the side's home box, in map order (chapter 1's "(Mexico, Cuba, Canada)").
 */
export const SLOTS = {
  cardPoints: "card",
  pointsBefore: "card",
  pointsAfter: "card",
  modifierTakesOff: "card",
  techRaceCost: "side",
  eventPoints: "card",
  influenceIn: "side",
  homeNeighbours: "side",
} as const satisfies Record<string, "card" | "side">;

export type SlotName = keyof typeof SLOTS;
/** A piece of a line: plain text, or a slot with the text after its colon. */
export type LinePiece = { text: string } | { slot: string; arg: string };

/**
 * A line cut into its plain text and its slots, written `{name:arg}`, in order. A brace that does not open or close a
 * slot is returned as an error, as is a slot with no name. splitLine does not check the names: lineText does.
 */
export function splitLine(line: string): { pieces: LinePiece[] } | { error: string } {
  const pieces: LinePiece[] = [];
  let rest = line;
  while (rest.length > 0) {
    const open = rest.indexOf("{");
    const close = rest.indexOf("}");
    if (close >= 0 && (open < 0 || close < open)) return { error: `"}" closes no slot` };
    if (open < 0) {
      pieces.push({ text: rest });
      break;
    }
    if (open > 0) pieces.push({ text: rest.slice(0, open) });
    const end = rest.indexOf("}", open);
    if (end < 0) return { error: `"{" opens a slot that never closes` };
    const inside = rest.slice(open + 1, end);
    if (inside.includes("{")) return { error: `"{" inside a slot` };
    const colon = inside.indexOf(":");
    const slot = colon < 0 ? inside : inside.slice(0, colon);
    if (slot === "") return { error: "a slot with no name" };
    pieces.push({ slot, arg: colon < 0 ? "" : inside.slice(colon + 1) });
    rest = rest.slice(end + 1);
  }
  return { pieces };
}

/** Why the slot `{slot:arg}` is wrong, or null when its name is known and its argument fits. */
function slotProblem(slot: string, arg: string): string | null {
  if (!Object.hasOwn(SLOTS, slot)) return `unknown slot "${slot}"`;
  const wants = SLOTS[slot as SlotName];
  if (wants === "side" && !side.safeParse(arg).success) return `slot "${slot}" needs a side, lio or sae`;
  if (wants === "card" && !ERA_1_IDS.has(arg)) return `slot "${slot}" needs an Era 1 card`;
  return null;
}

/** What a step, variant or aside says: some text, at most SAY_MAX characters, with only known slots. */
export const lineText = z
  .string()
  .min(1)
  .max(SAY_MAX)
  .superRefine((line, ctx) => {
    const split = splitLine(line);
    if ("error" in split) {
      ctx.addIssue({ code: "custom", message: `The line has ${split.error}.` });
      return;
    }
    for (const piece of split.pieces) {
      const problem = "slot" in piece ? slotProblem(piece.slot, piece.arg) : null;
      if (problem !== null) ctx.addIssue({ code: "custom", message: `The line has ${problem}.` });
    }
  });

/** Every condition kind a variant may test. */
export const CONDITIONS = [
  "noInfluence",
  "modifierInForce",
  "pointsBeforeEqualsAfter",
  "pointsBelowTechRaceCost",
] as const;

/**
 * One thing a variant tests, from the live game when its step starts showing:
 * - noInfluence: the side has no influence anywhere (chapter 1).
 * - modifierInForce: the named card's modifier is in force this turn (chapter 3, Rwandan Genocide).
 * - pointsBeforeEqualsAfter: the named rival card's play gives the same points with its event before and after
 *   (chapter 3).
 * - pointsBelowTechRaceCost: the named card's points now are below the cost of the tech race step the side would try
 *   (chapter 6).
 */
export const condition = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("noInfluence"), side }),
  z.strictObject({ kind: z.literal("modifierInForce"), card: era1Card }),
  z.strictObject({ kind: z.literal("pointsBeforeEqualsAfter"), card: era1Card }),
  z.strictObject({ kind: z.literal("pointsBelowTechRaceCost"), card: era1Card, side }),
]);

export type Condition = z.output<typeof condition>;
