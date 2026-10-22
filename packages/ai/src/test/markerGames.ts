// Test helpers for lasting markers and `has` conditions (R4): a small ruleset whose cards set two lasting
// labels, and cards whose yes/no question exists only while a label is set. Seeded games dealt as newGame deals.
import type { Step } from "@terminal-dusk/engine";
import { dealGame, ninetyCards } from "./testGames.ts";
import type { TestState } from "./testGames.ts";

/** The two lasting labels the marker cards set and the `has` cards test. */
export const MARKER_LABELS = ["alpha", "beta"] as const;

/** `if has <label> { choose yesNo (both sides); marker "<label>-then" } else { marker "<label>-else" }`. */
function hasEffect(label: string): Step[] {
  return [
    {
      op: "if",
      cond: { op: "has", marker: label },
      then: [
        { op: "choose", who: "both", decision: { kind: "yesNo" }, bind: "a" },
        { op: "marker", label: `${label}-then` },
      ],
      else: [{ op: "marker", label: `${label}-else` }],
    },
  ];
}

/**
 * Card i's effect, by i % 6: 0 and 3 set "alpha" and "beta" with a lasting marker, 1 and 4 test them with
 * `has` (hasEffect), and 2 and 5 do nothing.
 */
function effectOf(i: number): Step[] {
  const label = MARKER_LABELS[i % 6 < 3 ? 0 : 1];
  if (i % 3 === 0) return [{ op: "marker", label, lasting: true }];
  if (i % 3 === 1) return hasEffect(label);
  return [];
}

/** Ninety cards: ops 0-4, affiliations in turn, and the marker and `has` effects of effectOf. */
export const markerRuleset = ninetyCards("ai-marker-test", "m", effectOf);

/** A game of markerRuleset from `seed`. Four turns by default, so a marker set early is tested in later turns. */
export function newMarkerGame(seed: number, turns = 4): TestState {
  return dealGame(markerRuleset, "ai-marker", seed, turns);
}
