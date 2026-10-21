// createGame's check of a card's flags (#199): only `removeAfterEvent: true`, the one flag so far. The rest
// of the card checks are in cardChecks.test.ts, which is at its size limit.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { CardDef } from "./index.ts";
import { makeSetup, ruleset, testCard } from "./test/game.ts";

/** createGame's error for the test ruleset with LIO's l1 given `flags`, or "ok". */
const flagsError = (flags: unknown) => {
  const l1 = { ...testCard("l1", 1, "lio"), flags } as CardDef;
  const r = createGame({ ...ruleset, cards: [...ruleset.cards.slice(1), l1] }, makeSetup(), "seed-1");
  return r.ok ? "ok" : r.error;
};

describe("createGame: a card's flags", () => {
  it("accepts removeAfterEvent: true", () => {
    expect(flagsError({ removeAfterEvent: true })).toBe("ok");
  });

  it.each([
    ["an unknown key", { scoring: true }],
    ["removeAfterEvent: false", { removeAfterEvent: false }],
    ["removeAfterEvent that is not true", { removeAfterEvent: "yes" }],
    ["flags that are not an object", true],
    ["flags that are null", null],
    ["flags that are a list", ["removeAfterEvent"]],
  ])("refuses %s, naming the card", (_case, flags) => {
    expect(flagsError(flags)).toEqual({ code: "invalidRuleset", message: expect.stringContaining("Card l1") });
  });
});
