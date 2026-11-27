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
  say: string;
  variants?: readonly { if: readonly Condition[]; say: string; allow?: readonly Matcher[] }[];
};

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
  return split.pieces.map((p) => ("slot" in p ? slotText(p.slot, p.arg, frame, ruleset) : p.text)).join("");
}

/** Picks `line`'s variant for `frame` and fills its words. */
export function fillLine(line: Line, frame: Frame, ruleset: Ruleset): Filled {
  sameRuleset(frame, ruleset);
  const variants = line.variants ?? [];
  const index = variants.findIndex((v) => v.if.every((c) => holds(c, frame, ruleset)));
  if (index < 0) return { variant: null, text: fillText(line.say, frame, ruleset) };
  const chosen = variants[index]!;
  const text = fillText(chosen.say, frame, ruleset);
  return chosen.allow === undefined ? { variant: index, text } : { variant: index, text, allow: chosen.allow };
}
