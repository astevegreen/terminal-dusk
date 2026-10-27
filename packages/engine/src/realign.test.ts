// R16c (#317): the action menu and realigning (docs/design/map-and-points.md, "Points and actions" 2; owner, 26 Oct,
// "approved as recommended"). Each point buys one attempt, each attempt may pick a different country where the
// rival has influence, each side draws from its own deck, and the home box adds 1. Built on the test map
// (test/map.ts): alpha-bravo, bravo-charlie, alpha-charlie, charlie-delta, delta-echo; LIO's home box touches alpha,
// SAE's echo and delta. Every Contingency card in a deck has the same number, so the draws are known.
import { describe, expect, it } from "vitest";
import { apply, legalAnswers } from "./index.ts";
import type { AnswerValue, CountryId, GameEvent, GameState, PointsAction, Step } from "./index.ts";
import { realignBonus } from "./realign.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  accepted,
  applied,
  playAnswer,
  playAnswers,
  ruleset,
  sideCard,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";
import { mapSetup } from "./test/map.ts";
import { countOf, mapGame, spend } from "./test/mapGame.ts";

type Counts = Record<CountryId, { lio?: number; sae?: number }>;

const deckOf = (n: number): number[] => [n, n, n, n, n, n];

/**
 * A map game at LIO's first play where every LIO Contingency card is `lio` and every SAE card `sae`, with
 * influence set from `counts` (0 where none is given), or the map's start.
 */
function game(draws: { lio: number; sae: number } = { lio: 3, sae: 3 }, counts?: Counts, rs = ruleset): GameState {
  const setup = { ...mapSetup(), contingency: { lio: deckOf(draws.lio), sae: deckOf(draws.sae), world: deckOf(1) } };
  const state = playAnswers(startGame(2, 1, rs, setup), 2, rs);
  // The influence comes from mapGame: the same map, so the same countries in the same order.
  return counts === undefined
    ? state
    : { ...state, public: { ...state.public, influence: mapGame(counts).public.influence! } };
}

/** `state` at Escalation 5, where every region is closed to interventions (R16b) but not to realigning. */
const allClosed = (state: GameState): GameState => ({ ...state, public: { ...state.public, escalation: 5 } });

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue) {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

const realignIn = (state: GameState, country: CountryId | null) => answer(state, { kind: "realign", country });
const pick = (state: GameState, action: Exclude<PointsAction, "intervene">) =>
  answer(state, { kind: "chooseAction", action });

/** startWith `steps` on `state`, then "realign" picked on the action menu if it is offered. */
function realigning(steps: Step[], state: GameState): { state: GameState; events: GameEvent[] } {
  const started = startWith(steps, ruleset, state);
  if (started.state.public.pending[0]?.kind !== "chooseAction") return started;
  const next = applied(started.state, pick(started.state, "realign"));
  return { state: next.state, events: [...started.events, ...next.events] };
}

const realignedEvents = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "realigned");
const drawnDecks = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [e.deck] : []));

// Delta, stability 2: LIO 1, SAE 2. LIO controls charlie (3, stability 3) and SAE echo (1, stability 1).
// LIO's bonus: charlie (adjacent, controlled) 1. SAE's: echo 1, more influence 1, home box touches delta 1 = 3.
const DELTA: Counts = { delta: { lio: 1, sae: 2 }, charlie: { lio: 3 }, echo: { sae: 1 } };

describe("the action menu (R16c)", () => {
  it("offers place, intervene (R16b) and realign, in that order, when all are possible, with the points to spend", () => {
    const { state, events } = startWith([spend("lio", 2)], ruleset, game());
    expect(events).toEqual([{ kind: "pointsSpent", visibility: "public", side: "lio", amount: 2 }]);
    expect(state.public.pending).toEqual([
      {
        id: expect.any(String),
        side: "lio",
        kind: "chooseAction",
        options: { points: 2, actions: ["place", "intervene", "realign"], targets: ["charlie", "echo"] },
      },
    ]);
    expect(legalAnswers(ruleset, state, "lio")).toEqual([
      { kind: "chooseAction", action: "place" },
      { kind: "chooseAction", action: "intervene", country: "charlie" },
      { kind: "chooseAction", action: "intervene", country: "echo" },
      { kind: "chooseAction", action: "realign" },
    ]);
    expect(legalAnswers(ruleset, state, "sae")).toEqual([]);
  });

  it("all the points go to the one action picked: picking place asks for placings with every point", () => {
    const start = startWith([spend("lio", 2)], ruleset, game()).state;
    const next = accepted(start, pick(start, "place"));
    expect(next.public.pending[0]).toMatchObject({ kind: "placeInfluence", options: { points: 2 } });
  });

  it("all the points go to the one action picked: picking realign gives one attempt per point", () => {
    const start = startWith([spend("lio", 3)], ruleset, game()).state;
    const next = accepted(start, pick(start, "realign"));
    expect(next.public.pending).toEqual([
      { id: expect.any(String), side: "lio", kind: "realign", options: { attempts: 3, targets: ["charlie", "echo"] } },
    ]);
  });

  it("is not offered when the rival has no influence anywhere: the points go straight to placing", () => {
    const { state } = startWith([spend("lio", 2)], ruleset, game(undefined, { alpha: { lio: 2 } }));
    expect(state.public.pending[0]).toMatchObject({ kind: "placeInfluence", options: { points: 2 } });
  });

  it("is offered even when placing and intervening are impossible, as realign or pass: never started on its own", () => {
    // LIO has no influence: only alpha is in reach, and SAE controls it (2, stability 2), so 1 point buys nothing.
    // At Escalation 5 every region is closed to interventions (R16b); realigning does not look at that (R17 will).
    const { state } = startWith([spend("lio", 1)], ruleset, allClosed(game(undefined, { alpha: { sae: 2 } })));
    expect(state.public.pending).toEqual([
      {
        id: expect.any(String),
        side: "lio",
        kind: "chooseAction",
        options: { points: 1, actions: ["realign", "pass"], targets: [] },
      },
    ]);
    expect(legalAnswers(ruleset, state, "lio")).toEqual([
      { kind: "chooseAction", action: "realign" },
      { kind: "chooseAction", action: "pass" },
    ]);
  });

  it("passing leaves the points unspent: nothing is placed or realigned, and the program runs on", () => {
    const start = startWith(
      [spend("lio", 1), { op: "marker", label: "after" }],
      ruleset,
      allClosed(game(undefined, { alpha: { sae: 2 } })),
    ).state;
    const done = applied(start, pick(start, "pass"));
    expect(done.events.map((e) => e.kind)).toEqual(["marker"]);
    expect(done.state.public.influence).toEqual(start.public.influence);
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.map((d) => d.kind)).toEqual(["playCardAs"]);
  });

  it("pass is not on the menu when placing is possible: declining realign there means placing", () => {
    const start = startWith([spend("lio", 2)], ruleset, game()).state;
    const r = apply(ruleset, start, pick(start, "pass"));
    expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
  });

  it("pass is not on the menu when an intervention is possible: declining realign there means intervening", () => {
    // As in the realign-or-pass case, but with regions open: SAE's alpha can take an intervention.
    const start = startWith([spend("lio", 1)], ruleset, game(undefined, { alpha: { sae: 2 } })).state;
    expect(start.public.pending[0]).toMatchObject({ options: { actions: ["intervene", "realign"] } });
    const r = apply(ruleset, start, pick(start, "pass"));
    expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
  });

  it("an action not on the menu is refused as illegal", () => {
    const start = startWith([spend("lio", 2)], ruleset, game()).state;
    const r = apply(ruleset, start, answer(start, { kind: "chooseAction", action: "surrender" as "place" }));
    expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
  });
});

describe("realigning (R16c)", () => {
  it("may target any country where the rival has influence, adjacent or not, in the map's order, or stop", () => {
    // LIO has influence only in alpha; SAE in echo (not next to anything of LIO's) and foxtrot (no neighbours).
    const counts: Counts = { alpha: { lio: 2 }, echo: { sae: 1 }, foxtrot: { sae: 1 } };
    const { state } = realigning([spend("lio", 1)], game(undefined, counts));
    expect(legalAnswers(ruleset, state, "lio")).toEqual([
      { kind: "realign", country: "echo" },
      { kind: "realign", country: "foxtrot" },
      { kind: "realign", country: null },
    ]);
  });

  it("the side may stop early: the attempts left are not made, and the play ends", () => {
    const { state } = realigning([spend("lio", 3), { op: "marker", label: "after" }], game({ lio: 6, sae: 1 }));
    const second = applied(state, realignIn(state, "echo"));
    expect(second.state.public.pending[0]).toMatchObject({ kind: "realign", options: { attempts: 2 } });
    const done = applied(second.state, realignIn(second.state, null));
    expect(done.events.map((e) => e.kind)).toEqual(["marker"]);
    expect(done.state.public.influence).toEqual(second.state.public.influence);
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.some((d) => d.kind === "realign")).toBe(false);
  });

  it("the side may stop before its first attempt: nothing is drawn or removed", () => {
    const { state } = realigning([spend("lio", 2)], game());
    const done = applied(state, realignIn(state, null));
    expect(drawnDecks(done.events)).toEqual([]);
    expect(done.state.public.influence).toEqual(state.public.influence);
    expect(done.state.public.stack).toEqual([]);
  });

  it("a country where the rival has no influence is refused as illegal", () => {
    const { state } = realigning([spend("lio", 1)], game());
    for (const country of ["alpha", "bravo", "nowhere"]) {
      const r = apply(ruleset, state, realignIn(state, country));
      expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
    }
  });

  it("each side draws one card from its own deck, the acting side first", () => {
    const { state } = realigning([spend("sae", 1)], game());
    const done = applied(state, realignIn(state, "charlie"));
    expect(drawnDecks(done.events)).toEqual(["sae", "lio"]);
  });

  it("each side draws from its own deck even in a rival's card's event: never the World deck", () => {
    // SAE runs LIO's card: worldFor "lio" sends the event's draws from LIO's deck to the World deck.
    const r = startProgram(ruleset, game(), [spend("sae", 1)], "l1", "sae", "lio");
    if (!r.ok) throw new Error(r.error.code);
    const menu = r.value.state;
    const atRealign = accepted(menu, pick(menu, "realign"));
    const done = applied(atRealign, realignIn(atRealign, "charlie"));
    expect(drawnDecks(done.events)).toEqual(["sae", "lio"]);
  });

  it("totals are draw + 1 per adjacent country controlled + 1 for more influence + 1 for a home box touching it", () => {
    const { state } = realigning([spend("lio", 1)], game({ lio: 5, sae: 1 }, DELTA));
    const done = applied(state, realignIn(state, "delta"));
    expect(realignedEvents(done.events)).toEqual([
      {
        kind: "realigned",
        visibility: "public",
        side: "lio",
        country: "delta",
        totals: { lio: 6, sae: 4 },
        loser: "sae",
        removed: 2,
      },
    ]);
    expect(countOf(done.state, "delta", "sae")).toBe(0);
    expect(countOf(done.state, "delta", "lio")).toBe(1);
  });

  it("the higher total removes the difference from the loser, stopping at 0", () => {
    // 6 + 1 against 1 + 3: a difference of 3, but SAE has only 2 there.
    const { state } = realigning([spend("lio", 1)], game({ lio: 6, sae: 1 }, DELTA));
    const done = applied(state, realignIn(state, "delta"));
    expect(realignedEvents(done.events)[0]).toMatchObject({ totals: { lio: 7, sae: 4 }, loser: "sae", removed: 2 });
    expect(countOf(done.state, "delta", "sae")).toBe(0);
  });

  it("the acting side can lose: then it loses the difference from its own influence", () => {
    // 1 + 1 against 3 + 3: LIO loses 4, and has only 1 there.
    const { state } = realigning([spend("lio", 1)], game({ lio: 1, sae: 3 }, DELTA));
    const done = applied(state, realignIn(state, "delta"));
    expect(realignedEvents(done.events)[0]).toMatchObject({ totals: { lio: 2, sae: 6 }, loser: "lio", removed: 1 });
    expect(countOf(done.state, "delta", "lio")).toBe(0);
    expect(countOf(done.state, "delta", "sae")).toBe(2);
  });

  it("a tie changes nothing", () => {
    const { state } = realigning([spend("lio", 1)], game({ lio: 3, sae: 1 }, DELTA));
    const done = applied(state, realignIn(state, "delta"));
    expect(realignedEvents(done.events)[0]).toMatchObject({ totals: { lio: 4, sae: 4 }, loser: null, removed: 0 });
    expect(countOf(done.state, "delta", "lio")).toBe(1);
    expect(countOf(done.state, "delta", "sae")).toBe(2);
  });

  it("each point buys one attempt, each may pick a different country, and the play ends after the last", () => {
    const { state } = realigning([spend("lio", 2), { op: "marker", label: "after" }], game({ lio: 6, sae: 1 }));
    const second = applied(state, realignIn(state, "echo"));
    expect(second.state.public.pending[0]).toMatchObject({ kind: "realign", options: { attempts: 1 } });
    const done = applied(second.state, realignIn(second.state, "charlie"));
    expect(realignedEvents([...second.events, ...done.events]).map((e) => e.country)).toEqual(["echo", "charlie"]);
    expect(done.events.map((e) => e.kind)).toContain("marker");
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.some((d) => d.kind === "realign")).toBe(false);
  });

  it("attempts left once the rival has no influence anywhere are lost, and the play ends", () => {
    const { state } = realigning([spend("lio", 3)], game({ lio: 6, sae: 1 }, { alpha: { lio: 2 }, echo: { sae: 1 } }));
    const done = applied(state, realignIn(state, "echo"));
    expect(countOf(done.state, "echo", "sae")).toBe(0);
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.some((d) => d.kind === "realign")).toBe(false);
  });

  it("never changes the state it is given (frozen input)", () => {
    const start = deepFreeze(realigning([spend("lio", 1)], game({ lio: 6, sae: 1 }, DELTA)).state);
    const next = accepted(start, realignIn(start, "delta"));
    expect(countOf(start, "delta", "sae")).toBe(2);
    expect(countOf(next, "delta", "sae")).toBe(0);
  });
});

describe("a realignment's bonus (R16c)", () => {
  const at = (counts: Counts) => game(undefined, counts).public;

  it("adds 1 for each adjacent country the side controls", () => {
    // Bravo's neighbours: alpha and charlie, both LIO's.
    expect(
      realignBonus(at({ alpha: { lio: 2 }, charlie: { lio: 3 }, bravo: { sae: 1, lio: 1 } }), "lio", "bravo"),
    ).toBe(2);
  });

  it("adds 1 for more influence in the target, and nothing for equal influence", () => {
    expect(realignBonus(at({ foxtrot: { lio: 2, sae: 1 } }), "lio", "foxtrot")).toBe(1);
    expect(realignBonus(at({ foxtrot: { lio: 1, sae: 1 } }), "lio", "foxtrot")).toBe(0);
  });

  it("adds 1 when the side's home box touches the target", () => {
    // Alpha touches LIO's home box only; echo SAE's only. Neither side has more influence or adjacent control.
    expect(realignBonus(at({ alpha: { lio: 1, sae: 1 } }), "lio", "alpha")).toBe(1);
    expect(realignBonus(at({ alpha: { lio: 1, sae: 1 } }), "sae", "alpha")).toBe(0);
    expect(realignBonus(at({ echo: { lio: 1, sae: 1 } }), "sae", "echo")).toBe(1);
    expect(realignBonus(at({ echo: { lio: 1, sae: 1 } }), "lio", "echo")).toBe(0);
  });
});

describe("a card played for its points can realign (R16c)", () => {
  it("asks for the action, realigns with each point, then the game moves on to the next play", () => {
    const rs = withCards(sideCard("l3", 2));
    const atPlay = game({ lio: 6, sae: 1 }, undefined, rs);
    const menu = accepted(atPlay, playAnswer(atPlay, "lio", "l3", "points"), rs);
    expect(menu.public.pending[0]).toMatchObject({ side: "lio", kind: "chooseAction", options: { points: 2 } });
    const first = accepted(menu, pick(menu, "realign"), rs);
    const second = accepted(first, realignIn(first, "echo"), rs);
    const done = accepted(second, realignIn(second, "charlie"), rs);
    expect(countOf(done, "echo", "sae")).toBe(0);
    expect(countOf(done, "charlie", "sae")).toBe(0);
    expect(done.public.pending).toEqual([expect.objectContaining({ side: "sae", kind: "playCardAs" })]);
    expect(done.public.discard).toContain("l3");
  });
});
