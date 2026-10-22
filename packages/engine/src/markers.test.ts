// Lasting markers (#141): a marker step with `lasting: true` keeps its label in state.public.markers until the game ends.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { createGame } from "./createGame.ts";
import { legalAnswers } from "./decisions.ts";
import { seedHash } from "./sha256.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  cardAnswer,
  choose,
  marker,
  markers,
  openWith,
  playAnswers,
  ruleset,
  rulesetWith,
  sideCard,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";
import type { CardDef, GameEvent, GameState, Ruleset, Setup, Step } from "./types.ts";

const lasting = (label: string, v?: string): Step =>
  v === undefined ? { op: "marker", label, lasting: true } : { op: "marker", label, var: v, lasting: true };
const markerEvents = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "marker");

describe("a plain marker", () => {
  it("emits a marker event with no lasting field and keeps nothing in the state", () => {
    const { state, events } = startWith([marker("plain")]);
    expect(markerEvents(events)).toEqual([{ kind: "marker", visibility: "public", label: "plain" }]);
    expect(state.public.markers).toEqual([]);
  });
});

describe("a lasting marker", () => {
  it("createGame starts every game with no lasting markers", () => {
    expect(startGame().public.markers).toEqual([]);
  });

  it("emits the marker event with lasting: true and adds its label to markers", () => {
    const { state, events } = startWith([lasting("x")]);
    expect(markerEvents(events)).toEqual([{ kind: "marker", visibility: "public", label: "x", lasting: true }]);
    expect(state.public.markers).toEqual(["x"]);
  });

  it("keeps labels in the order first set, never twice; setting one again emits the event and leaves the list", () => {
    const { state, events } = startWith([lasting("b"), lasting("a"), lasting("b")]);
    expect(markers(events)).toEqual(["b", "a", "b"]);
    expect(state.public.markers).toEqual(["b", "a"]);
    const again = startWith([lasting("a")], ruleset, state);
    expect(markers(again.events)).toEqual(["a"]);
    expect(again.state.public.markers).toEqual(["b", "a"]);
  });

  it("with a bound var, the event carries its value but markers keeps only the label", () => {
    const paused = startWith([choose("a"), lasting("v", "a")]);
    const { state, events } = answerYesNo(paused.state, true);
    expect(markerEvents(events)).toEqual([
      { kind: "marker", visibility: "public", label: "v", value: true, lasting: true },
    ]);
    expect(state.public.markers).toEqual(["v"]);
  });

  it("naming an unbound var fails as a plain marker does, and adds nothing to markers", () => {
    const before = startWith([]).state;
    const plain = startProgram(ruleset, before, [marker("u", "nope")]);
    const kept = startProgram(ruleset, before, [lasting("u", "nope")]);
    expect(kept).toEqual(plain);
    expect(kept.ok).toBe(false);
    expect(before.public.markers).toEqual([]);
  });

  it("apply never mutates its frozen input while lasting markers are set", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("x")]), sideCard("s1", 1, [lasting("y")]));
    const frozen = deepFreeze(startGame(2, 1, rs));
    const half = deepFreeze(apply(rs, frozen, cardAnswer(frozen, "lio", "l1", rs)));
    if (!half.ok) throw new Error("rejected");
    const r = apply(rs, half.value.state, cardAnswer(half.value.state, "sae", "s1", rs));
    expect(r.ok && r.value.state.public.markers).toEqual(["x", "y"]);
    expect(half.value.state.public.markers).toEqual([]);
  });
});

describe("a lasting marker stays until the game ends", () => {
  /**
   * Three turns. LIO is dealt l1, whose event, unless "x" is already set, sets lasting "x" and draws from
   * LIO's 3-card Contingency deck (so that deck is reshuffled at once). If l1 comes back and is played
   * again, a marker event shows "x" was lost. The 5-card draw pile runs out on turn 2's refill, so the
   * discard pile is reshuffled; era2 enters on turn 2.
   */
  const rs: Ruleset = (() => {
    const base = rulesetWith(["l1", "s1", "s2", "n1", "n2", "z1", "z2", "e1"]);
    const setX: Step[] = [lasting("x"), { op: "drawContingency", side: "lio" }];
    const cards: CardDef[] = base.cards.map((c) => {
      if (c.id === "l1")
        return { ...c, effect: [{ op: "if", cond: { op: "has", marker: "x" }, then: [], else: setX }] };
      return c.id === "e1" ? { ...c, era: "era2" } : c;
    });
    return { ...base, cards };
  })();
  const setup: Setup = {
    seedHash: seedHash("seed-1"),
    hands: { lio: ["l1"], sae: [] },
    deck: ["s1", "s2", "n1", "n2", "z1"],
    turns: 3,
    playsPerTurn: 1,
    handSize: 2,
    eras: [{ era: "era2", turn: 2, cards: ["e1"] }],
    contingency: { lio: [1, 2, 3], sae: [1, 2, 3], world: [1, 2, 3] },
  };

  it("is kept through turn ends, a new era, refills and both reshuffles, to the last turn and after the game is over", () => {
    const created = createGame(rs, setup, "seed-1");
    if (!created.ok) throw new Error(created.error.message);
    const s0 = created.value.state;
    let state: GameState = openWith(s0, "l1", s0.private.sae.hand[0]!, rs).state;
    expect(state.public.markers).toEqual(["x"]);
    const kinds = new Set<string>();
    let lastTurnSeen = false;
    while (state.public.status.kind === "active") {
      const d = state.public.pending[0]!;
      const r = apply(rs, state, { decisionId: d.id, side: d.side, value: legalAnswers(rs, state, d.side)[0]! });
      if (!r.ok) throw new Error(r.error.code);
      for (const e of r.value.events) kinds.add(e.kind);
      expect(r.value.events.some((e) => e.kind === "marker")).toBe(false);
      state = r.value.state;
      if (state.public.turn === 3) lastTurnSeen = true;
      expect(state.public.markers).toEqual(["x"]);
    }
    expect(lastTurnSeen).toBe(true);
    expect([...kinds]).toEqual(expect.arrayContaining(["eraStarted", "drawPileReshuffled"]));
    expect(state.public.markers).toEqual(["x"]);
  });

  it("the opening card's event reshuffled LIO's Contingency deck while setting the marker", () => {
    const created = createGame(rs, setup, "seed-1");
    if (!created.ok) throw new Error(created.error.message);
    const s0 = created.value.state;
    const saePick = s0.private.sae.hand[0]!;
    const { events } = openWith(s0, "l1", saePick, rs);
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["marker", "contingencyDeckReshuffled"]));
  });
});

describe("where a lasting marker is set", () => {
  it("by an opening card: kept the same way", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("open")]));
    const { state } = openWith(startGame(2, 1, rs), "l1", "s1", rs);
    expect(state.public.markers).toEqual(["open"]);
    expect(playAnswers(state, 2, rs).public.markers).toEqual(["open"]);
  });

  it("inside a reaction (a trigger's do): kept the same way, after the trigger has ended", () => {
    const trigger: Step = { op: "trigger", hook: "turnEnd", do: [lasting("react")], duration: { kind: "turnEnd" } };
    const rs = withCards(sideCard("l1", 1, [trigger]));
    const { state } = openWith(startGame(2, 1, rs), "l1", "s1", rs);
    expect(state.public.markers).toEqual([]);
    const turn2 = playAnswers(state, 2, rs);
    expect(turn2.public.turn).toBe(2);
    expect(turn2.public.triggers).toEqual([]);
    expect(turn2.public.markers).toEqual(["react"]);
  });
});
