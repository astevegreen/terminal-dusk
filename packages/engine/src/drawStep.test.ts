// The drawContingency step (#65): a card's effect draws from a named side's Contingency deck, and a later
// step of the same card can read the number drawn.
import { describe, expect, it } from "vitest";
import { apply } from "./index.ts";
import type { GameEvent, GameState, Ruleset, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  applied,
  ifYes,
  marker,
  markers,
  openWith,
  orderAnswer,
  playAnswer,
  ruleset,
  setupPlus,
  sideCard,
  startAtPlay,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";

const draws = (side: Side, bind?: string): Step =>
  bind === undefined ? { op: "drawContingency", side } : { op: "drawContingency", side, bind };
const drawnEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "contingencyDrawn" || e.kind === "contingencyDeckReshuffled");

/** A 2-turn, 1-play game opened with l1 and s1 (no events), so LIO's play is open. */
const atLioPlay = (
  rs: Ruleset,
  extra: { lio?: string[] } = {},
  decks = { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
): GameState => openWith(startGame(2, 1, rs, { ...setupPlus(extra), contingency: decks }), "l1", "s1", rs).state;

describe("the drawContingency step", () => {
  it("binds the number drawn, and a later step of the same program reads it through the variable", () => {
    const s = startAtPlay();
    const top = s.secret.contingency.lio[0]!;
    const r = startWith([draws("lio", "n"), marker("drew", "n")], ruleset, s);
    expect(markers(r.events)).toEqual([`drew:${top}`]);
    expect(r.events[0]).toEqual({ kind: "contingencyDrawn", visibility: "public", side: "lio", value: top });
  });

  it("without bind, still draws, emits its event and moves on to the next step", () => {
    const s = startAtPlay();
    const r = startWith([draws("sae"), marker("after")], ruleset, s);
    expect(drawnEvents(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "sae", value: s.secret.contingency.sae[0] },
    ]);
    expect(markers(r.events)).toEqual(["after"]);
    expect(r.state.secret.contingency.sae).toEqual(s.secret.contingency.sae.slice(1));
    expect(r.state.public.stack).toEqual([]);
  });

  it("draws from the deck its side names, and leaves the other side's deck alone", () => {
    const s = startAtPlay();
    const r = startWith([draws("sae", "n")], ruleset, s);
    expect(r.state.secret.contingency.lio).toEqual(s.secret.contingency.lio);
    expect(r.state.public.contingency.lio).toEqual(s.public.contingency.lio);
    expect(r.state.public.contingency.sae.left).toHaveLength(5);
  });

  it("an if whose condition reads a number-bound variable returns invalidProgram", () => {
    const r = startProgram(ruleset, startAtPlay(), [draws("lio", "n"), ifYes("n", [marker("yes")])]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });

  it("names a single side: the type rejects both", () => {
    // @ts-expect-error: a draw comes from one side's deck, never both.
    const both: Step = { op: "drawContingency", side: "both" };
    expect(both.op).toBe("drawContingency");
  });

  it("an event card draws from the deck of the side the event belongs to, even when the rival plays it for points", () => {
    const rs = withCards(sideCard("s9", 2, [draws("sae", "n"), marker("drew", "n")]));
    const s = atLioPlay(rs, { lio: ["s9"] });
    const waiting = applied(s, playAnswer(s, "lio", "s9", "points"), rs).state;
    const r = applied(waiting, orderAnswer(waiting, "lio", "before"), rs);
    expect(drawnEvents(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "sae", value: s.secret.contingency.sae[0] },
    ]);
    expect(r.state.secret.contingency.lio).toEqual(s.secret.contingency.lio);
  });

  it("apply never changes deep-frozen inputs when a played event draws and reshuffles", () => {
    const rs = deepFreeze(withCards(sideCard("l9", 2, [draws("lio", "n"), marker("drew", "n")])));
    const s = deepFreeze(atLioPlay(rs, { lio: ["l9"] }, { lio: [3, 7], sae: [1, 2] }));
    const before = JSON.stringify(s);
    const r = apply(rs, s, deepFreeze(playAnswer(s, "lio", "l9", "event")));
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    expect(drawnEvents(r.value.events).map((e) => e.kind)).toEqual(["contingencyDrawn", "contingencyDeckReshuffled"]);
    expect(r.value.state.public.contingency.lio).toEqual({ cards: [3, 7], left: [3, 7] });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("drawing from the rival's deck (owner, 19 Oct)", () => {
  it("an LIO card's event that names SAE's deck takes SAE's top card, shown publicly, and leaves LIO's deck alone", () => {
    const rs = withCards(sideCard("l9", 2, [draws("sae", "n"), marker("drew", "n")]));
    const s = atLioPlay(rs, { lio: ["l9"] });
    const [top, ...rest] = s.secret.contingency.sae;
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(drawnEvents(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "sae", value: top },
    ]);
    expect(markers(r.events)).toEqual([`drew:${top}`]);
    expect(r.state.secret.contingency.sae).toEqual(rest);
    expect(r.state.public.contingency.sae.left).toEqual([1, 2, 3, 4, 5, 6].filter((n) => n !== top));
    expect(r.state.secret.contingency.lio).toEqual(s.secret.contingency.lio);
    expect(r.state.public.contingency.lio).toEqual(s.public.contingency.lio);
  });

  it("the card it uses up counts toward the rival deck's reshuffle like any draw", () => {
    const rs = withCards(sideCard("l9", 2, [draws("sae")]));
    const s = atLioPlay(rs, { lio: ["l9"] }, { lio: [1, 2, 3, 4, 5, 6], sae: [3, 7] });
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(drawnEvents(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "sae", value: s.secret.contingency.sae[0] },
      { kind: "contingencyDeckReshuffled", visibility: "public", side: "sae" },
    ]);
    expect(r.state.public.contingency.sae).toEqual({ cards: [3, 7], left: [3, 7] });
  });

  it("the card names the deck, not who played it: SAE's card played by LIO for points draws LIO's deck", () => {
    const rs = withCards(sideCard("s9", 2, [draws("lio", "n"), marker("drew", "n")]));
    const s = atLioPlay(rs, { lio: ["s9"] });
    const waiting = applied(s, playAnswer(s, "lio", "s9", "points"), rs).state;
    const r = applied(waiting, orderAnswer(waiting, "lio", "before"), rs);
    expect(drawnEvents(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "lio", value: s.secret.contingency.lio[0] },
    ]);
    expect(r.state.secret.contingency.sae).toEqual(s.secret.contingency.sae);
  });

  it("one card may draw from both decks, each draw taking that deck's top card", () => {
    const rs = withCards(sideCard("l9", 2, [draws("lio", "a"), draws("sae", "b"), marker("a", "a"), marker("b", "b")]));
    const s = atLioPlay(rs, { lio: ["l9"] });
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(markers(r.events)).toEqual([`a:${s.secret.contingency.lio[0]}`, `b:${s.secret.contingency.sae[0]}`]);
    expect(r.state.secret.contingency.lio).toEqual(s.secret.contingency.lio.slice(1));
    expect(r.state.secret.contingency.sae).toEqual(s.secret.contingency.sae.slice(1));
  });
});
