// Test helpers for the playedBy condition (R5): a small ruleset whose cards test who played them, and ask both
// sides a yes/no only on the `then` branch, so a decision exists on one branch alone. Seeded games dealt as
// newGame deals: each side holds cards of both sides, so cards are played for their event, by their rival for
// points (the rival's event runs), and picked to open a turn.
import type { AnswerValue, CardId, Ruleset, Side, Step } from "@terminal-dusk/engine";
import { dealGame, ninetyCards } from "./testGames.ts";
import type { TestState } from "./testGames.ts";

export type Branch = "then" | "else";
/** What a card's effect is, by its index: a test of `playedBy lio`, of `playedBy sae`, the sae test inside a turnEnd trigger, or nothing. */
export type Shape = "lio" | "sae" | "turnEnd" | "none";
/** How a card was last put in play: picked to open the turn, played for its event, or for its points. */
export type How = "opening" | "event" | "points";

const SHAPES: readonly Shape[] = ["lio", "sae", "turnEnd", "none"];

/** The marker a card's branch records: `<card id>-<side tested>-<branch>`. */
export const branchLabel = (card: CardId, side: Side, branch: Branch): string => `${card}-${side}-${branch}`;

/** `if playedBy <side> { choose yesNo (both sides); marker "<card>-<side>-then" } else { marker "<card>-<side>-else" }`. */
function playedByEffect(card: CardId, side: Side): Step[] {
  return [
    {
      op: "if",
      cond: { op: "playedBy", side },
      then: [
        { op: "choose", who: "both", decision: { kind: "yesNo" }, bind: "a" },
        { op: "marker", label: branchLabel(card, side, "then") },
      ],
      else: [{ op: "marker", label: branchLabel(card, side, "else") }],
    },
  ];
}

/** Card i's shape, by i % 4. With affiliations by i % 3, every shape is on LIO, SAE and neutral cards. */
export const shapeOf = (i: number): Shape => SHAPES[i % 4]!;

/** Card i's effect: its playedBy test, or that test of `playedBy sae` inside a trigger that fires at turn end. */
function effectOf(i: number): Step[] {
  const card = `p${i + 1}`;
  const shape = shapeOf(i);
  if (shape === "lio" || shape === "sae") return playedByEffect(card, shape);
  if (shape === "turnEnd") {
    return [{ op: "trigger", hook: "turnEnd", do: playedByEffect(card, "sae"), duration: { kind: "turnEnd" } }];
  }
  return [];
}

/** Ninety cards `p1` to `p90`: ops 0-4, affiliations in turn, and the playedBy effects of effectOf. */
export const playedByRuleset: Ruleset = ninetyCards("ai-playedby-test", "p", effectOf);

/** A game of playedByRuleset from `seed`. Four turns, so each side plays several cards of both sides. */
export function newPlayedByGame(seed: number, turns = 4): TestState {
  return dealGame(playedByRuleset, "ai-playedby", seed, turns);
}

/** A branch marker's card, the side its test named and the branch taken; null for any other label. */
export function parseBranch(label: string): { card: CardId; side: Side; branch: Branch } | null {
  const match = /^(p\d+)-(lio|sae)-(then|else)$/.exec(label);
  return match === null ? null : { card: match[1]!, side: match[2] as Side, branch: match[3] as Branch };
}

/** The card an answer picks or plays and how, or null for an answer that puts no card in play. */
export function playOf(value: AnswerValue): { card: CardId; how: How } | null {
  if (value.kind === "chooseCard") return { card: value.card, how: "opening" };
  if (value.kind === "playCardAs") return { card: value.card, how: value.as === "event" ? "event" : "points" };
  return null;
}
