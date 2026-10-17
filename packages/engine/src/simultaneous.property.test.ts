// Property test: the order in which the two sides answer a simultaneous pair changes nothing, for a
// turn's opening card pick and for a program's yes/no pair.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, legalAnswers, SIDES } from "./index.ts";
import type { Answer, GameState, Ruleset, Side, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  choose,
  forEach,
  ifSaid,
  marker,
  playAnswers,
  ruleset as baseRuleset,
  startGame,
  startWith,
  yesNoAnswer,
} from "./test/game.ts";

/** The test ruleset with ops of 1 to 3 and an event that marks the card, so the opening order shows in events. */
const ruleset: Ruleset = {
  ...baseRuleset,
  cards: baseRuleset.cards.map((c, i) => ({ ...c, ops: 1 + (i % 3), effect: [marker(c.id)] })),
};

/** A program that opens a pair, then uses both answers; sometimes it opens a second pair at the end. */
const programArb: fc.Arbitrary<Step[]> = fc
  .tuple(fc.constantFrom(...SIDES), fc.array(fc.constantFrom("a", "b"), { maxLength: 3 }), fc.boolean())
  .map(([side, items, again]) => [
    choose("v", "both"),
    marker("v", "v"),
    ifSaid(side, "v", [marker("yes")], [marker("no")]),
    forEach(items, "x", [marker("i", "x")]),
    ...(again ? [choose("w", "both"), marker("w", "w")] : []),
  ]);

/**
 * A state with a pair open: the opening card pick at the start of some turn, or a program's pair
 * started at LIO's first play of some turn. Each turn of 1 play each is 4 answers.
 */
const caseArb = fc.record({
  turns: fc.integer({ min: 1, max: 4 }),
  played: fc.nat(),
  program: fc.option(programArb, { nil: undefined }),
  yes: fc.record({ lio: fc.boolean(), sae: fc.boolean() }),
  pick: fc.record({ lio: fc.nat(), sae: fc.nat() }),
});
type Case = { turns: number; played: number; program: Step[] | undefined };
type Choice = { yes: Record<Side, boolean>; pick: Record<Side, number> };

function openPair(c: Case): GameState {
  const atTurn = playAnswers(startGame(c.turns, 1, ruleset), 4 * (c.played % c.turns), ruleset);
  return deepFreeze(c.program ? startWith(c.program, ruleset, playAnswers(atTurn, 2, ruleset)).state : atTurn);
}

/** `side`'s answer to its half of the pair: yes/no, or the legal card at its `pick` index. */
function answerOf(s: GameState, side: Side, choice: Choice): Answer {
  const d = s.public.pending.find((x) => x.side === side)!;
  if (d.kind === "yesNo") return yesNoAnswer(s, choice.yes[side], side);
  const legal = legalAnswers(ruleset, s, side);
  return { decisionId: d.id, side, value: legal[choice.pick[side] % legal.length]! };
}

function answerInOrder(s: GameState, order: readonly Side[], choice: Choice) {
  const first = apply(ruleset, s, answerOf(s, order[0]!, choice));
  if (!first.ok) throw new Error(`first answer rejected: ${first.error.code}`);
  const half = deepFreeze(first.value.state);
  const second = apply(ruleset, half, answerOf(half, order[1]!, choice));
  if (!second.ok) throw new Error(`second answer rejected: ${second.error.code}`);
  return { firstEvents: first.value.events, state: second.value.state, events: second.value.events };
}

describe("simultaneous decisions: answer order", () => {
  it("LIO-then-SAE and SAE-then-LIO give identical final states, and the second apply returns identical events", () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const s = openPair(c);
        const lioFirst = answerInOrder(s, ["lio", "sae"], c);
        const saeFirst = answerInOrder(s, ["sae", "lio"], c);
        expect(saeFirst.state).toStrictEqual(lioFirst.state);
        expect(JSON.stringify(saeFirst.state)).toBe(JSON.stringify(lioFirst.state));
        expect(saeFirst.events).toStrictEqual(lioFirst.events);
        expect(JSON.stringify(saeFirst.events)).toBe(JSON.stringify(lioFirst.events));
        expect([lioFirst.firstEvents, saeFirst.firstEvents]).toEqual([[], []]);
      }),
      { numRuns: 300 },
    );
  });
});
