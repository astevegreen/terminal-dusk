// TEST-ONLY FIXTURES, never game content: a second fuzz ruleset whose cards make triggers (#90) and modifiers
// (#89) that ask questions, make more modifiers and triggers, and draw contingencies from inside a reaction.
// The cards have the same ids, eras, ops and affiliations as the fuzz cards in play.ts, so every random setup
// and chooser works on them, and each card's effect is picked by its index from the fixed list below (no
// randomness in the cards). Nothing here is shipped; the real cards live in packages/content.
import type { Ruleset, Side, Step } from "@terminal-dusk/engine";
import { deepFreeze } from "./deepFreeze.ts";
import { baseEffectOf, playFuzzGame, ruleset } from "./play.ts";
import type { Played } from "./play.ts";
import { playerDraw } from "./playerDraws.ts";

type TriggerStep = Extract<Step, { op: "trigger" }>;
const UNTIL_TURN_END = { kind: "turnEnd" } as const;

/** A trigger on `hook` with the reaction `steps`; like every fixture step it ends with the turn. */
const trigger = (hook: TriggerStep["hook"], steps: Step[]): Step => ({
  op: "trigger",
  hook,
  do: steps,
  duration: UNTIL_TURN_END,
});
/** A question to one side, with its answer marked. */
const asks = (who: Side, label: string): Step[] => [
  { op: "choose", who, decision: { kind: "yesNo" }, bind: "a" },
  { op: "marker", label, var: "a" },
];

const ADDS: readonly number[] = [-2, -1, 1, 2];
const MINS: readonly (number | undefined)[] = [0, 1, undefined];
const MOD_SIDES: readonly (Side | "both")[] = ["lio", "sae", "both"];
/** The `k`th ops-value modifier step: add over -2..2 without 0, min none, 0 or 1, side lio, sae or both. */
function opsModifier(k: number): Step {
  const [add, min, side] = [ADDS[k % 4]!, MINS[k % 3], MOD_SIDES[Math.floor(k / 3) % 3]!];
  return {
    op: "modifier",
    mod: min === undefined ? { hook: "opsValue", side, add } : { hook: "opsValue", side, add, min },
    duration: UNTIL_TURN_END,
  };
}

/** Kinds of reaction fixture, picked by card index modulo this many; kinds 8 to 10 keep only the base effect. */
const KINDS = 11; // coprime to 3, so every kind turns up with every affiliation

/**
 * Card `i`'s reaction step, or null for the cards that keep only their existing fuzz effect. `k` counts the
 * cards of the same kind, so the modifiers spread over every add, min and side. Questions go to the side
 * picked by `k`; a contingency draw is from the card's own side's deck, or for a neutral card from the deck
 * of the side that picked or played it.
 */
function reactionOf(i: number): Step | null {
  const [kind, k] = [i % KINDS, Math.floor(i / KINDS)];
  const side: Side = k % 2 === 0 ? "lio" : "sae";
  const own: Side = i % 3 === 0 ? "lio" : "sae"; // affiliations go lio, sae, neutral (play.ts)
  switch (kind) {
    case 0:
      return trigger("cardPlayed", asks(side, "reactionAsked"));
    case 1:
      return trigger("turnEnd", asks(side, "turnEndAsked"));
    case 2:
      return trigger("cardPlayed", [opsModifier(k)]);
    case 3:
      return trigger("cardPlayed", [trigger("turnEnd", [{ op: "marker", label: "setByReaction", var: "turn" }])]);
    case 4:
      return trigger("turnEnd", [trigger("turnEnd", [{ op: "marker", label: "retriggered", var: "turn" }])]);
    case 5:
      return trigger("cardPlayed", [
        { op: "choose", who: "both", decision: { kind: "yesNo" }, bind: "both" },
        { op: "marker", label: "bothAsked" },
      ]);
    case 6: {
      // A neutral card's reaction draws from the deck of the side that picked or played it (#117).
      const draw: Step[] =
        i % 3 === 2 ? playerDraw(`c${i + 1}`, "n", true) : [{ op: "drawContingency", side: own, bind: "n" }];
      return trigger("cardPlayed", [...draw, { op: "marker", label: "drewInReaction", var: "n" }]);
    }
    case 7:
      return opsModifier(k + 1);
    default:
      return null;
  }
}

/** Card `i`'s event: its existing fuzz effect, then its reaction step, if it has one. */
function effectOf(i: number): Step[] {
  const reaction = reactionOf(i);
  return reaction === null ? baseEffectOf(i) : [...baseEffectOf(i), reaction];
}

/**
 * The fixture cards whose reaction makes a modifier. Those cards only start a modifier from inside a reaction,
 * so a modifierStarted event with one as source came from a trigger firing.
 */
export function reactionModifierCards(rules: Ruleset): string[] {
  return rules.cards
    .filter((card) => card.effect.some((s) => s.op === "trigger" && s.do.some((r) => r.op === "modifier")))
    .map((card) => card.id);
}

export const reactionsRuleset: Ruleset = deepFreeze({
  id: "fuzz-reactions-ruleset",
  cards: ruleset.cards.map((card, i) => ({ ...card, effect: effectOf(i) })),
});

/** Reaction game `game`: the setup, seed and choosers of fuzz game `game`, on the reaction cards. */
export function playReactionGame(game: number): Played {
  return playFuzzGame(game, reactionsRuleset, "playReactionGame");
}
