// A side with no card left for a play it owes passes the rest of its plays this turn (owner, 7 Nov 2026: "player
// passes the rest of their plays"; docs/design/core-loop.md, "Playing a card", "No card left"). A discard can empty
// a hand mid-turn; before this rule the game then waited on a play that had no legal answer.
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./decisions.ts";
import { eventsFor } from "./events.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { applied, makeSetup, openWith, playAnswer, sideCard, startGame, withCards } from "./test/game.ts";
import type { GameEvent, GameState, Ruleset, Side, Step } from "./types.ts";

const discardAll = (side: Side): Step => ({ op: "discardFromHand", side, count: 20 });

/** The test ruleset with l1's event discarding the whole hand of each side in `sides`. */
const emptying = (...sides: Side[]): Ruleset => withCards(sideCard("l1", 1, sides.map(discardAll)));

/** Every pending decision has at least one legal answer: the game never waits on a play nobody can make. */
function expectAnswerable(rules: Ruleset, state: GameState): void {
  for (const d of state.public.pending) expect(legalAnswers(rules, state, d.side), d.kind).not.toEqual([]);
}

/** The sides of the playPassed events in `events`, in order: one for each play passed. */
const passes = (events: readonly GameEvent[]): Side[] =>
  events.flatMap((event) => (event.kind === "playPassed" ? [event.side] : []));

/** A game of `turns` turns and 2 plays each, opened with `lio` and `sae` (default l6 and s6, no effects). */
function opened(rules: Ruleset, turns = 2, lio = "l6", sae = "s6"): GameState {
  return deepFreeze(openWith(startGame(turns, 2, rules, makeSetup(turns, 2)), lio, sae, rules).state);
}

describe("a side with no card left for a play it owes passes the rest of its plays", () => {
  it("SAE, whose hand LIO's play discards, passes both its plays: LIO plays on, then the next turn opens", () => {
    const rules = emptying("sae");
    const start = opened(rules);
    const discarded = applied(start, playAnswer(start, "lio", "l1", "event"), rules);
    const afterDiscard = discarded.state;
    expect(afterDiscard.private.sae.hand).toEqual([]);
    expect(afterDiscard.public.playsMade).toBe(2);
    expect(passes(discarded.events)).toEqual(["sae"]);
    expect(afterDiscard.public.pending).toMatchObject([{ kind: "playCardAs", side: "lio" }]);
    expectAnswerable(rules, afterDiscard);

    const nextPlayed = applied(deepFreeze(afterDiscard), playAnswer(afterDiscard, "lio", "l2", "event"), rules);
    const next = nextPlayed.state;
    expect(passes(nextPlayed.events)).toEqual(["sae"]);
    expect(next.public.turn).toBe(2);
    expect(next.public.playsMade).toBe(0);
    expect(next.public.pending.map((d) => [d.side, d.kind])).toEqual([
      ["lio", "chooseCard"],
      ["sae", "chooseCard"],
    ]);
    // The pass draws nothing: SAE's hand is refilled only by the next turn's refill, to the hand size.
    expect(next.private.sae.hand).toHaveLength(3);
    expectAnswerable(rules, next);
  });

  it("LIO, discarding its own last card, passes its later play: SAE makes both of its plays", () => {
    const rules = emptying("lio");
    const start = opened(rules);
    const discarded = applied(start, playAnswer(start, "lio", "l1", "event"), rules);
    const afterDiscard = discarded.state;
    expect(afterDiscard.private.lio.hand).toEqual([]);
    expect(afterDiscard.public.pending).toMatchObject([{ kind: "playCardAs", side: "sae" }]);
    expect(passes(discarded.events)).toEqual([]);

    const saePlayed = applied(deepFreeze(afterDiscard), playAnswer(afterDiscard, "sae", "s1", "event"), rules);
    const afterSae = saePlayed.state;
    expect(passes(saePlayed.events)).toEqual(["lio"]);
    expect(afterSae.public.playsMade).toBe(3);
    expect(afterSae.public.pending).toMatchObject([{ kind: "playCardAs", side: "sae" }]);
    expectAnswerable(rules, afterSae);

    const nextPlayed = applied(deepFreeze(afterSae), playAnswer(afterSae, "sae", "s2", "event"), rules);
    expect(passes(nextPlayed.events)).toEqual([]);
    const next = nextPlayed.state;
    expect(next.public.turn).toBe(2);
    expect(next.private.lio.hand).toHaveLength(3);
  });

  it("an opening card's discard makes the side pass every play of the turn", () => {
    const rules = emptying("sae");
    const start = opened(rules, 2, "l1", "s6");
    expect(start.private.sae.hand).toEqual([]);
    expect(start.public.pending).toMatchObject([{ kind: "playCardAs", side: "lio" }]);
    const secondPlayed = applied(start, playAnswer(start, "lio", "l2", "event"), rules);
    const second = secondPlayed.state;
    expect(second.public.pending).toMatchObject([{ kind: "playCardAs", side: "lio" }]);
    expect(second.public.playsMade).toBe(2);
    expect(passes(secondPlayed.events)).toEqual(["sae"]);
    const nextPlayed = applied(deepFreeze(second), playAnswer(second, "lio", "l3", "event"), rules);
    expect(passes(nextPlayed.events)).toEqual(["sae"]);
    expect(nextPlayed.state.public.turn).toBe(2);
  });

  it("when neither side has a card left, the turn ends at once, and after the last turn the game is over", () => {
    const rules = emptying("lio", "sae");
    const start = opened(rules, 1, "l3", "s3");
    const { state, events } = applied(start, playAnswer(start, "lio", "l1", "event"), rules);
    expect(passes(events)).toEqual(["sae", "lio", "sae"]);
    expect(state.public.pending).toEqual([]);
    expect(state.public.status).toEqual({ kind: "over", winner: null, reason: "turnLimitReached" });
  });

  it("each pass is a public event: both sides and spectators see which side passed", () => {
    const rules = emptying("sae");
    const start = opened(rules);
    const { events } = applied(start, playAnswer(start, "lio", "l1", "event"), rules);
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(
        eventsFor(events, viewer).filter((e) => e.kind === "playPassed"),
        viewer,
      ).toEqual([{ kind: "playPassed", visibility: "public", side: "sae" }]);
    }
  });
});
