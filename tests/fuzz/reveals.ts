// TEST-ONLY FIXTURES, never game content: the `revealHand` steps (R6a) the fuzz cards run. Every reveal is
// announced by a plain marker emitted straight before it, naming where the reveal sits and whose hand it shows,
// so the tests can count reveals by place from the events alone. Markers ask nothing, so no decision id changes.
import type { GameEvent, Side, Step } from "@terminal-dusk/engine";

/** Starts every reveal announcement's label; then the place and the side whose hand is shown. */
export const REVEAL = "reveal:";

/** Where a reveal sits: at the top of an effect, inside an if, or in a reaction on either hook. */
export type RevealWhere = "top" | "nested" | "turnEnd" | "cardPlayed";

const sideOf = (n: number): Side => (n % 2 === 0 ? "lio" : "sae");

/** A reveal of `side`'s hand, announced first. */
export function revealStep(side: Side, where: RevealWhere): Step[] {
  return [
    { op: "marker", label: `${REVEAL}${where}:${side}` },
    { op: "revealHand", side },
  ];
}

/**
 * Fuzz card `i`'s reveal steps (cards.ts). Every eighth card from c6 on shows a hand at the top level; every eighth
 * from c8 on (a card that asks a yes or no question, bound to "a") shows one hand in each branch of an `if` on
 * that answer. The side shown takes turns, and 8 is coprime to 3, so LIO, SAE and neutral cards all show both.
 */
export function revealOf(i: number): Step[] {
  const side = sideOf(Math.floor(i / 8));
  if (i % 8 === 5) return revealStep(side, "top");
  if (i % 8 !== 7) return [];
  const other = sideOf(Math.floor(i / 8) + 1);
  return [
    { op: "if", cond: { op: "yes", var: "a" }, then: revealStep(side, "nested"), else: revealStep(other, "nested") },
  ];
}

/**
 * Reaction card `i`'s reveal trigger (reactions.ts), or none: every fifth card from c3 on leaves a trigger that shows
 * a hand, on cardPlayed and turnEnd in turn, the side shown changing every two such cards. 5 is coprime to 2 and 3,
 * so within c3 to c58 every hook, side and affiliation turns up together.
 */
export function revealTriggerOf(i: number): Step[] {
  if (i % 5 !== 2) return [];
  const k = Math.floor(i / 5);
  const hook = k % 2 === 0 ? "cardPlayed" : "turnEnd";
  return [{ op: "trigger", hook, do: revealStep(sideOf(Math.floor(k / 2)), hook), duration: { kind: "turnEnd" } }];
}

/** The place and side a reveal announcement names; null for any other event. */
export function announcedReveal(event: GameEvent): { where: RevealWhere; side: Side } | null {
  if (event.kind !== "marker" || !event.label.startsWith(REVEAL)) return null;
  const match = /^reveal:(top|nested|turnEnd|cardPlayed):(lio|sae)$/.exec(event.label);
  return match === null ? null : { where: match[1] as RevealWhere, side: match[2] as Side };
}
