// createGame's checks of a card's discardFromHand steps (#186): LIO or SAE, and a whole count of 1 or more;
// and a chosenBy, if given, of "owner" or "player" (#192).
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { Step } from "./index.ts";
import { choose, forEach, ifYes, makeSetup, ruleset, testCard } from "./test/game.ts";

const discard = (side: unknown, count: unknown): Step => ({ op: "discardFromHand", side, count }) as unknown as Step;
/** A trigger step, "at the turn's end, run `reaction`". */
const trigger = (reaction: Step[]): Step => ({
  op: "trigger",
  hook: "turnEnd",
  do: reaction,
  duration: { kind: "turnEnd" },
});
/** `step` at the top of an effect, in an if's then and else, in a forEach and in a trigger's reaction. */
const nested = (step: Step): Step[][] => [
  [step],
  [choose("go"), ifYes("go", [step])],
  [choose("go"), ifYes("go", [], [step])],
  [forEach(["a"], "x", [step])],
  [trigger([step])],
];
/** createGame's result with LIO's card l1 given `effect`. */
const resultOf = (effect: Step[]) =>
  createGame(
    { ...ruleset, cards: [...ruleset.cards.slice(1), testCard("l1", 1, "lio", effect)] },
    makeSetup(),
    "seed-1",
  );

describe("createGame: discardFromHand steps name LIO or SAE and a whole count, 1 or more", () => {
  it.each([
    ["missing", undefined],
    ["0", 0],
    ["-1", -1],
    ["1.5", 1.5],
    ["text", "2"],
  ])("refuses a count that is %s, at any depth, with a plain-English message naming the card", (_what, count) => {
    for (const effect of nested(discard("lio", count))) {
      expect(resultOf(effect)).toMatchObject({
        ok: false,
        error: {
          code: "invalidRuleset",
          message: "Card l1's effect discards a number of cards that is not a whole number, 1 or more.",
        },
      });
    }
  });

  it.each([
    ["missing", undefined],
    ["both", "both"],
    ["player", "player"],
    ["neutral", "neutral"],
  ])("refuses a side that is %s, at any depth, with a plain-English message naming the card", (_what, side) => {
    for (const effect of nested(discard(side, 1))) {
      expect(resultOf(effect)).toMatchObject({
        ok: false,
        error: {
          code: "invalidRuleset",
          message: `Card l1's effect discards from the hand of a side that is not "lio" or "sae".`,
        },
      });
    }
  });

  it("accepts a discardFromHand of lio or sae with a count of 1 or more, at any depth", () => {
    const good: [string, number][] = [
      ["lio", 1],
      ["sae", 2],
      ["lio", 9],
    ];
    for (const [side, count] of good) {
      for (const effect of nested(discard(side, count))) expect(resultOf(effect).ok).toBe(true);
    }
  });
});

describe("createGame: a discardFromHand's chosenBy is owner or player (#192)", () => {
  const chosen = (chosenBy: unknown): Step =>
    ({ op: "discardFromHand", side: "sae", count: 1, chosenBy }) as unknown as Step;

  it.each(["owner", "player"])("accepts chosenBy %s, at any depth", (chosenBy) => {
    for (const effect of nested(chosen(chosenBy))) expect(resultOf(effect).ok).toBe(true);
  });

  it.each(["random", "rival", "both", "lio", 1, null])(
    "refuses chosenBy %s, at any depth, with a plain-English message naming the card",
    (chosenBy) => {
      for (const effect of nested(chosen(chosenBy))) {
        expect(resultOf(effect)).toMatchObject({
          ok: false,
          error: {
            code: "invalidRuleset",
            message: `Card l1's effect has a discard chosen by someone other than "owner" or "player" (leave chosenBy out for a random discard).`,
          },
        });
      }
    },
  );
});
