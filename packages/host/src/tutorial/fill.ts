// Fills a tutorial line from the live game (#699; docs/design/tutorial.md, "Numbers and places come from the live
// game"): picks the first variant whose conditions all hold, then fills each `{slot:arg}` of its words. It reads the
// learner's frame (its public part only) and the ruleset's card data, never GameState (hard rule 2), the clock or
// randomness. A slot or condition it cannot work out throws, so a line never shows blank or wrong text.
import { splitLine, type Condition } from "@terminal-dusk/content";
import type { Ruleset, Side } from "@terminal-dusk/engine";
import type { Frame } from "../types.ts";
import * as live from "./livePoints.ts";
import type { Matcher } from "./matching.ts";

/** A line as a lesson gives it: its words and, for a step, its variants. */
export type Line = {
  say: Say;
  variants?: readonly { if: readonly Condition[]; say: Say; allow?: readonly Matcher[] }[];
};
/** One line, or several shown together (Decision (architect), #701). */
type Say = string | readonly string[];

/** The variant chosen (its index, or null for the line's own words), its filled text, and its own allow, if any. */
export type Filled = { variant: number | null; text: string; allow?: readonly Matcher[] };

const { fail } = live;
const isSide = (arg: string): arg is Side => arg === "lio" || arg === "sae";
const sideOf = (arg: string): Side => (isSide(arg) ? arg : fail(`"${arg}" is not a side.`));

/** The learner's side: a frame for a player, never a spectator's. */
function learner(frame: Frame): Side {
  return isSide(frame.viewer) ? frame.viewer : fail("a spectator's frame has no learner.");
}

/** Whether `c` holds in `frame` now. */
function holds(c: Condition, frame: Frame, ruleset: Ruleset): boolean {
  const view = frame.view;
  const me = learner(frame);
  switch (c.kind) {
    case "noInfluence":
      return live.influenceIn(view, c.side).length === 0;
    case "modifierInForce":
      return view.public.modifiers.some((m) => m.source === c.card);
    case "pointsBeforeEqualsAfter": {
      const card = live.cardIn(ruleset, c.card);
      return live.pointsBefore(view, card, me) === live.cardPoints(view, card, me);
    }
    case "pointsBelowTechRaceCost":
      return live.cardPoints(view, live.cardIn(ruleset, c.card), c.side) < live.raceCost(view, c.side);
    case "resultBelowDraw":
      return live.belowDraw(view, live.cardIn(ruleset, c.card), me) > 0;
    case "resultAboveDraw":
      return live.belowDraw(view, live.cardIn(ruleset, c.card), me) < 0;
    case "onePoint":
      return live.cardPoints(view, live.cardIn(ruleset, c.card), me) === 1;
    case "gameOver":
      return view.public.status.kind !== "active";
  }
}

/** The text slot `{slot:arg}` stands for in `frame`. */
function slotText(slot: string, arg: string, frame: Frame, ruleset: Ruleset): string {
  const view = frame.view;
  const me = learner(frame);
  const card = () => live.cardIn(ruleset, arg);
  const names = (list: string[]) => (list.length > 0 ? list.join(", ") : fail(`{${slot}:${arg}} names no country.`));
  switch (slot) {
    case "cardPoints":
    case "pointsAfter":
      return String(live.cardPoints(view, card(), me));
    case "pointsBefore":
      return String(live.pointsBefore(view, card(), me));
    case "modifierTakesOff":
      return String(live.modifierTakesOff(view, card(), me));
    case "eventPoints":
      return String(live.eventPoints(view, card(), me));
    case "techRaceCost":
      return String(live.raceCost(view, sideOf(arg)));
    case "influenceIn":
      return names(live.influenceIn(view, sideOf(arg)));
    case "homeNeighbours":
      return names(live.homeNeighbours(view, sideOf(arg)));
    case "belowDraw": {
      // "0 below" and "above" are not approved words: the line's own words cover 4 points, and more has no words yet.
      const below = live.belowDraw(view, card(), me);
      return below > 0 ? String(below) : fail(`{belowDraw:${arg}} is ${below}: the result is not below the draw.`);
    }
    case "aboveDraw": {
      const above = -live.belowDraw(view, card(), me);
      return above > 0 ? String(above) : fail(`{aboveDraw:${arg}} is ${above}: the result is not above the draw.`);
    }
    default:
      return fail(`unknown slot "${slot}".`);
  }
}

/** Throws unless `frame` comes from `ruleset`: its slots and conditions read that ruleset's cards. */
function sameRuleset(frame: Frame, ruleset: Ruleset): void {
  if (frame.ruleset !== ruleset.id) fail(`the frame is from ruleset ${frame.ruleset}, not ${ruleset.id}.`);
}

/** `words` with every slot filled from `frame`. A frame from another ruleset throws, even for words with no slot. */
export function fillText(words: string, frame: Frame, ruleset: Ruleset): string {
  sameRuleset(frame, ruleset);
  const split = splitLine(words);
  if ("error" in split) return fail(`the line has ${split.error}.`);
  let previous = "";
  return split.pieces
    .map((p) => {
      previous = "slot" in p ? slotText(p.slot, p.arg, frame, ruleset) : agree(previous, p.text);
      return previous;
    })
    .join("");
}

/**
 * `text` after the filled `number`: a leading " point" or " points" reads "point" after 1 and "points" after any
 * other number (owner, 27 Nov 2026, #701: "a filled number of points always reads 1 point or N points").
 */
function agree(number: string, text: string): string {
  if (!/^\d+$/.test(number)) return text;
  return text.replace(/^ points?\b/, number === "1" ? " point" : " points");
}

/** `say` filled: several lines are each filled, then shown together as paragraphs. */
function fillSay(say: Say, frame: Frame, ruleset: Ruleset): string {
  return typeof say === "string"
    ? fillText(say, frame, ruleset)
    : say.map((l) => fillText(l, frame, ruleset)).join("\n\n");
}

/** Picks `line`'s variant for `frame` and fills its words. */
export function fillLine(line: Line, frame: Frame, ruleset: Ruleset): Filled {
  sameRuleset(frame, ruleset);
  const variants = line.variants ?? [];
  const index = variants.findIndex((v) => v.if.every((c) => holds(c, frame, ruleset)));
  if (index < 0) return { variant: null, text: fillSay(line.say, frame, ruleset) };
  const chosen = variants[index]!;
  const text = fillSay(chosen.say, frame, ruleset);
  return chosen.allow === undefined ? { variant: index, text } : { variant: index, text, allow: chosen.allow };
}
