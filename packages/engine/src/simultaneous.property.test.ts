// Property test: the order in which the two sides answer a simultaneous pair changes nothing.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, SIDES } from "./index.ts";
import type { GameState, Side, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  choose,
  forEach,
  ifSaid,
  marker,
  playAnswers,
  ruleset,
  startGame,
  startWith,
  yesNoAnswer,
} from "./test/game.ts";

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

/** A state with a pair open: the placeholder's opening pair at the start of some round, or a program's pair. */
const caseArb = fc.record({
  rounds: fc.integer({ min: 1, max: 4 }),
  played: fc.nat(),
  program: fc.option(programArb, { nil: undefined }),
  yes: fc.record({ lio: fc.boolean(), sae: fc.boolean() }),
});

function openPair(c: { rounds: number; played: number; program: Step[] | undefined }): GameState {
  const atRound = playAnswers(startGame(c.rounds), 4 * (c.played % c.rounds));
  return deepFreeze(c.program ? startWith(c.program, ruleset, atRound).state : atRound);
}

function answerInOrder(s: GameState, order: readonly Side[], yes: Record<Side, boolean>) {
  const first = apply(ruleset, s, yesNoAnswer(s, yes[order[0]!], order[0]));
  if (!first.ok) throw new Error(`first answer rejected: ${first.error.code}`);
  const half = deepFreeze(first.value.state);
  const second = apply(ruleset, half, yesNoAnswer(half, yes[order[1]!], order[1]));
  if (!second.ok) throw new Error(`second answer rejected: ${second.error.code}`);
  return { firstEvents: first.value.events, state: second.value.state, events: second.value.events };
}

describe("simultaneous decisions: answer order", () => {
  it("LIO-then-SAE and SAE-then-LIO give identical final states, and the second apply returns identical events", () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const s = openPair(c);
        const lioFirst = answerInOrder(s, ["lio", "sae"], c.yes);
        const saeFirst = answerInOrder(s, ["sae", "lio"], c.yes);
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
