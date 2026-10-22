// TEST-ONLY FIXTURES, never game content: the `playedBy` conditions (R5a) the fuzz cards test, and the fuzz
// check that each test took exactly one branch, the right one. Every test is announced by a plain marker
// emitted before its `if`, naming the card, the side tested and where the test sits; each branch emits only a
// marker naming the branch, so the branches change no decision ids, seq or random draws.
import type { Answer, CardId, GameEvent, Ruleset, Side, Step } from "@terminal-dusk/engine";

/** Starts every playedBy marker's label: an announcement, then card, side and place; a branch, then card and branch. */
export const PLAYED_BY = "playedBy:";

/** Where a playedBy test sits: at the top of an effect, nested in another if, or in a reaction on either hook. */
export type Where = "top" | "nested" | "turnEnd" | "cardPlayed";
export type Branch = "then" | "else";
/** How a card was put in play: picked to open the turn, played for its event, or the rival's card played for its points. */
export type How = "opening" | "event" | "rivalPoints" | "points";
/** Who picked or played a card, and how. */
export type PlayRecord = { side: Side; how: How };
/** One playedBy test the check saw: what was tested, where, the branch taken, and the card's play record. */
export type Taken = { card: CardId; side: Side; where: Where; branch: Branch; play: PlayRecord };

const marker = (label: string): Step => ({ op: "marker", label });
const announceLabel = (card: CardId, side: Side, where: Where): string => `${PLAYED_BY}${card}:${side}:${where}`;
export const branchLabel = (card: CardId, branch: Branch): string => `${PLAYED_BY}${card}:${branch}`;
const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/**
 * Card `card`'s test of `playedBy side`, announced first. Each branch emits its branch marker, then `then` or
 * `otherwise` (steps run after the branch marker, such as a nested test).
 */
export function playedByStep(
  card: CardId,
  side: Side,
  where: Where,
  then: Step[] = [],
  otherwise: Step[] = [],
): Step[] {
  return [
    marker(announceLabel(card, side, where)),
    {
      op: "if",
      cond: { op: "playedBy", side },
      then: [marker(branchLabel(card, "then")), ...then],
      else: [marker(branchLabel(card, "else")), ...otherwise],
    },
  ];
}

/** A top-level test of `playedBy side` with a second test, of the other side, nested inside each branch. */
export function nestedPlayedBy(card: CardId, side: Side): Step[] {
  const inner = playedByStep(card, other(side), "nested");
  return playedByStep(card, side, "top", inner, inner);
}

type Announced = { card: CardId; side: Side; where: Where };

/** The test a playedBy announcement names; null for any other event. */
export function announcedTest(event: GameEvent): Announced | null {
  if (event.kind !== "marker" || !event.label.startsWith(PLAYED_BY)) return null;
  const match = /^playedBy:([^:]+):(lio|sae):(top|nested|turnEnd|cardPlayed)$/.exec(event.label);
  return match === null ? null : { card: match[1]!, side: match[2] as Side, where: match[3] as Where };
}

/** The card and branch a playedBy branch marker names; null for any other event. */
export function branchTaken(event: GameEvent): { card: CardId; branch: Branch } | null {
  if (event.kind !== "marker" || !event.label.startsWith(PLAYED_BY)) return null;
  const match = /^playedBy:([^:]+):(then|else)$/.exec(event.label);
  return match === null ? null : { card: match[1]!, branch: match[2] as Branch };
}

/**
 * Notes in `plays` who picked or played a card in `answer`, and how. A card is picked or played at most once a
 * turn and its triggers end with the turn, so the last play noted is the one its tests read.
 */
export function notePlay(plays: Map<CardId, PlayRecord>, rules: Ruleset, answer: Answer): void {
  if (!("value" in answer)) return;
  const { value } = answer;
  if (value.kind === "chooseCard") plays.set(value.card, { side: answer.side, how: "opening" });
  if (value.kind !== "playCardAs") return;
  const affiliation = rules.cards.find((card) => card.id === value.card)?.affiliation;
  const rival = affiliation !== undefined && affiliation !== "neutral" && affiliation !== answer.side;
  const how: How = value.as === "event" ? "event" : rival ? "rivalPoints" : "points";
  plays.set(value.card, { side: answer.side, how });
}

/**
 * Every announced playedBy test in `events` (one step's) is followed, before the next announcement, by exactly
 * one branch marker for its card, and that branch is "then" exactly when the side tested is the side that last
 * picked or played the card. A branch marker with no open test fails too. Returns the tests taken, in order.
 */
export function checkPlayedBy(events: readonly GameEvent[], plays: ReadonlyMap<CardId, PlayRecord>): Taken[] {
  const taken: Taken[] = [];
  let open: Announced | null = null;
  const unbranched = (test: Announced) =>
    new Error(`card ${test.card}'s playedBy ${test.side} test (${test.where}) took no branch`);
  for (const [i, event] of events.entries()) {
    const announced = announcedTest(event);
    if (announced !== null) {
      if (open !== null) throw unbranched(open);
      open = announced;
      continue;
    }
    const branch = branchTaken(event);
    if (branch === null) continue;
    const test = open;
    if (test === null || test.card !== branch.card) {
      throw new Error(`event ${i}: card ${branch.card}'s playedBy branch "${branch.branch}" has no test announced`);
    }
    open = null;
    const play = plays.get(test.card);
    if (play === undefined) throw new Error(`card ${test.card} tested playedBy, but no side picked or played it`);
    const expected: Branch = play.side === test.side ? "then" : "else";
    if (branch.branch !== expected) {
      throw new Error(
        `card ${test.card}'s playedBy ${test.side} test (${test.where}) took "${branch.branch}", ` +
          `but ${play.side} picked or played it`,
      );
    }
    taken.push({ ...test, branch: branch.branch, play });
  }
  if (open !== null) throw unbranched(open);
  return taken;
}
