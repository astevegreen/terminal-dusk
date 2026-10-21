// TEST-ONLY FIXTURES, never game content: the fuzz suite's cards, c1 to c85, and the sizes of a random game
// their number is worked out from. Each card's effect is picked by its index (no randomness in the cards).
import type { CardDef, CardId, Ruleset, Side, Step as EffectStep } from "@terminal-dusk/engine";
import { deepFreeze } from "./deepFreeze.ts";
import { hasStep, LASTING_LABELS, lastingMarker } from "./markers.ts";
import { nestedPlayedBy, playedByStep } from "./playedBy.ts";
import { playerDraw } from "./playerDraws.ts";
import { revealOf } from "./reveals.ts";

/** Most turns and plays per turn in a random game, and the non-neutral cards a hand then needs. */
export const MAX_TURNS = 4;
export const MAX_PLAYS = 2;
const MOST_NEEDED = MAX_TURNS * (1 + MAX_PLAYS);
/** Most cards of any affiliation a random hand gets beyond the ones it needs, and most in a draw pile. */
export const MAX_EXTRA = 8;
export const MAX_PILE = 30;
/** Most eras after the first (one for each turn after the first), and most cards in one era. */
const MAX_ERAS = MAX_TURNS - 1;
export const MAX_ERA_CARDS = 5;
/** Every card a random setup can use, c1 to c85. Affiliations go LIO, SAE, neutral, so 57 are non-neutral. */
export const FUZZ_CARDS: readonly CardId[] = Array.from(
  { length: 2 * (MOST_NEEDED + MAX_EXTRA) + MAX_PILE + MAX_ERAS * MAX_ERA_CARDS },
  (_, i) => `c${i + 1}`,
);
const AFFILIATIONS: readonly CardDef["affiliation"][] = ["lio", "sae", "neutral"];
/**
 * Card `i`'s event: its base event (baseEffectOf), then its lasting marker step (markerStepsOf), then its
 * playedBy tests (playedByOf), then its hand reveals (revealOf, #185), and for every fifth card from c2 on, a modifier of the ops value too (#89); for
 * every tenth from c4 on (never a modifier card), a trigger (#90). Only steps are added after the base event,
 * never a choice, so the decisions of the games in fixedGames.ts keep their IDs.
 */
function effectOf(i: number): EffectStep[] {
  const base = [...baseEffectOf(i), ...markerStepsOf(i), ...playedByOf(i), ...revealOf(i)];
  if (i % 10 === 3) return [...base, triggerOf(Math.floor(i / 10), i)];
  return i % 5 === 1 ? [...base, modifierOf(Math.floor(i / 5))] : base;
}

/**
 * Card `i`'s playedBy tests (#170), markers only: every seventh card from c5 on tests one side at the top level,
 * and every seventh from c7 on also nests a test of the other side inside each branch; the side tested takes turns.
 */
function playedByOf(i: number): EffectStep[] {
  const side: Side = Math.floor(i / 7) % 2 === 0 ? "lio" : "sae";
  if (i % 7 === 4) return playedByStep(`c${i + 1}`, side, "top");
  return i % 7 === 6 ? nestedPlayedBy(`c${i + 1}`, side) : [];
}

/**
 * Card `i`'s lasting marker step (#142): every sixth card from c6 on sets a lasting marker, and every sixth
 * from c3 on tests one with `has`, the labels taking turns, so both are set and tested on several cards.
 */
function markerStepsOf(i: number): EffectStep[] {
  const label = LASTING_LABELS[Math.floor(i / 6) % LASTING_LABELS.length]!;
  if (i % 6 === 5) return [lastingMarker(label)];
  return i % 6 === 2 ? [hasStep(label, false)] : [];
}

/**
 * The `k`th trigger card's step (card `i`), cardPlayed and turnEnd in turn, until the turn ends. Its reaction
 * is a marker showing what the hook binds, so it never asks a new question; a neutral card's reaction also
 * draws from the deck of the side that picked or played the card.
 */
function triggerOf(k: number, i: number): EffectStep {
  const shown: EffectStep =
    k % 2 === 0 ? { op: "marker", label: "reacted", var: "card" } : { op: "marker", label: "turnEnded", var: "turn" };
  const reaction = AFFILIATIONS[i % 3] === "neutral" ? [shown, ...playerDraw(`c${i + 1}`, undefined, true)] : [shown];
  return { op: "trigger", hook: k % 2 === 0 ? "cardPlayed" : "turnEnd", do: reaction, duration: { kind: "turnEnd" } };
}

const ADDS: readonly number[] = [-2, -1, 1, 2];
const MINS: readonly (number | undefined)[] = [0, 1, undefined];
const MODIFIER_SIDES: readonly (Side | "both")[] = ["lio", "sae", "both"];
/** The `k`th modifier card's step: its add, min and side spread by `k` over every value, until the turn ends. */
function modifierOf(k: number): EffectStep {
  const [add, min, side] = [ADDS[k % 4]!, MINS[k % 3], MODIFIER_SIDES[Math.floor(k / 3) % 3]!];
  return {
    op: "modifier",
    mod: min === undefined ? { hook: "opsValue", side, add } : { hook: "opsValue", side, add, min },
    duration: { kind: "turnEnd" },
  };
}

/**
 * Card `i`'s base event. Every fourth asks LIO or SAE yes or no, so opening and played events pause for a
 * choice. The other LIO and SAE cards draw a contingency from their own side's deck, so games draw and
 * reshuffle (#65): two in three of them show the number through a variable, the rest draw without one.
 * Neutral cards draw from the deck of the side that picked or played them (#117), announced for the
 * whose-deck check (playerDraws.ts): after asking LIO or SAE, after asking both sides at once, or straight away.
 */
export function baseEffectOf(i: number): EffectStep[] {
  const side = AFFILIATIONS[i % 3]!;
  const id = `c${i + 1}`;
  if (i % 4 === 3) {
    const asked: EffectStep[] = [
      { op: "choose", who: i % 8 === 3 ? "lio" : "sae", decision: { kind: "yesNo" }, bind: "a" },
      { op: "marker", label: "asked", var: "a" },
    ];
    return side === "neutral" ? [...asked, ...playerDraw(id)] : asked;
  }
  if (side === "neutral") {
    if (i % 4 === 0) {
      const both: EffectStep = { op: "choose", who: "both", decision: { kind: "yesNo" }, bind: "b" };
      return [both, { op: "marker", label: "bothAsked" }, ...playerDraw(id)];
    }
    return i % 4 === 2 ? playerDraw(id) : [...playerDraw(id, "n"), { op: "marker", label: "drew", var: "n" }];
  }
  if (i % 4 === 2) return [{ op: "drawContingency", side }];
  return [
    { op: "drawContingency", side, bind: "n" },
    { op: "marker", label: "drew", var: "n" },
  ];
}

/**
 * Whether card `i` leaves the game once its event happens (R8a; #205): every seventh card from c4 on, so c4
 * (LIO), c11 (SAE), c18 (neutral) and so on. 7 is coprime to 3, so every affiliation has some; no card of the
 * games in fixedGames.ts is flagged, so they replay unchanged.
 */
export const removesAfterEvent = (i: number): boolean => i % 7 === 3;

export const ruleset: Ruleset = deepFreeze({
  id: "fuzz-ruleset",
  cards: FUZZ_CARDS.map((id, i) => ({
    id,
    era: "fuzz",
    ops: i % 5,
    affiliation: AFFILIATIONS[i % 3]!,
    effect: effectOf(i),
    ...(removesAfterEvent(i) ? { flags: { removeAfterEvent: true as const } } : {}),
  })),
});
