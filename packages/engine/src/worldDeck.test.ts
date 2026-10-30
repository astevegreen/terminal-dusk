// The World deck (#131; docs/design/contingency-deck.md, "The World deck"): when a side plays the rival's card,
// as its opening pick or for its action points, every draw the event names from the rival's own deck comes
// from the World deck. Draws it names from the player's deck stay there. Nothing else uses the World deck.
import { describe, expect, it } from "vitest";
import type { DeckId, GameEvent, GameState, Ruleset, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import {
  answerYesNo,
  applied,
  choose,
  openWith,
  orderAnswer,
  playAnswer,
  ruleset,
  setupPlus,
  sideCard as card,
  startAtPlay,
  startGame,
  withCards,
} from "./test/game.ts";

const draw = (side: Side | "player"): Step => ({ op: "drawContingency", side });
/** "Each side draws; the higher number wins": one draw from LIO's deck, one from SAE's. */
const EACH_SIDE_DRAWS: Step[] = [draw("lio"), draw("sae")];

/** Each draw, in order, as the deck it came from and the number drawn: "world:4" and so on. */
const drawsIn = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [`${e.deck}:${e.value}`] : []));
/** The top card of `deck` in `state`, as drawsIn shows a draw of it. */
const top = (state: GameState, deck: DeckId): string => `${deck}:${state.secret.contingency[deck][0]}`;

/** Expects `deck`'s order and numbers left to be as in `before`. */
function untouched(before: GameState, after: GameState, deck: DeckId): void {
  expect(after.secret.contingency[deck]).toEqual(before.secret.contingency[deck]);
  expect(after.public.contingency[deck]).toEqual(before.public.contingency[deck]);
}

/** A 2-turn, 1-play game with `extra` cards in hand, opened with l1 and s1 (no events), so LIO's play is open. */
const atPlay = (rs: Ruleset, extra: { lio?: string[]; sae?: string[] }): GameState =>
  openWith(startGame(2, 1, rs, setupPlus(extra)), "l1", "s1", rs).state;

/** SAE plays `played` for its points with its event first, after LIO plays l2 for its points. */
function saePlaysForPoints(rs: Ruleset, played: string): { before: GameState; events: GameEvent[]; state: GameState } {
  const s = atPlay(rs, { sae: [played] });
  const lioPlayed = applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
  const waiting = applied(lioPlayed, playAnswer(lioPlayed, "sae", played, "points"), rs).state;
  const r = applied(waiting, orderAnswer(waiting, "sae", "before"), rs);
  return { before: s, ...r };
}

describe("a rival's card draws from the World deck for its owner's deck", () => {
  it('"each side draws; the higher number wins": LIO\'s card played by SAE for its points draws one World card and one SAE card', () => {
    const rs = withCards(card("l9", 2, EACH_SIDE_DRAWS));
    const r = saePlaysForPoints(rs, "l9");
    expect(drawsIn(r.events)).toEqual([top(r.before, "world"), top(r.before, "sae")]);
    untouched(r.before, r.state, "lio");
  });

  it("SAE's card played by LIO for its points: its LIO draw comes from LIO's deck, its SAE draw from the World deck", () => {
    const rs = withCards(card("s9", 2, EACH_SIDE_DRAWS));
    const s = atPlay(rs, { lio: ["s9"] });
    const waiting = applied(s, playAnswer(s, "lio", "s9", "points"), rs).state;
    const r = applied(waiting, orderAnswer(waiting, "lio", "after"), rs);
    expect(drawsIn(r.events)).toEqual([top(s, "lio"), top(s, "world")]);
    untouched(s, r.state, "sae");
  });

  it.each([
    ["SAE picks LIO's card", "l9", { sae: ["l9"] }, ["l1", "l9"], ["world", "sae"], "lio"],
    ["LIO picks SAE's card", "s9", { lio: ["s9"] }, ["s9", "s1"], ["lio", "world"], "sae"],
  ] as const)("as an opening pick: %s", (_case, id, extra, [lio, sae], decks, owner) => {
    const rs = withCards(card(id, 2, EACH_SIDE_DRAWS));
    const s = startGame(2, 1, rs, setupPlus(extra));
    const r = openWith(s, lio, sae, rs);
    expect(drawsIn(r.events)).toEqual(decks.map((d) => top(s, d)));
    untouched(s, r.state, owner);
  });

  it("a start of the program for a rival's card outside the turn structure draws the same way", () => {
    const rs = withCards(card("l9", 2, EACH_SIDE_DRAWS));
    const s = startAtPlay();
    const r = startProgram(rs, s, EACH_SIDE_DRAWS, "l9", "sae");
    if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
    expect(drawsIn(r.value.events)).toEqual([top(s, "world"), top(s, "sae")]);
  });
});

describe("nothing else uses the World deck", () => {
  it("SAE plays its own SAE card that draws from LIO's deck: LIO's deck is drawn, not the World deck", () => {
    const rs = withCards(card("s9", 2, [draw("lio")]));
    const s = atPlay(rs, { sae: ["s9"] });
    const lioPlayed = applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
    const r = applied(lioPlayed, playAnswer(lioPlayed, "sae", "s9", "event"), rs);
    expect(drawsIn(r.events)).toEqual([top(s, "lio")]);
    untouched(s, r.state, "world");
  });

  it("a side's own card drawing from both decks draws from both, as before", () => {
    const rs = withCards(card("l9", 2, EACH_SIDE_DRAWS));
    const s = atPlay(rs, { lio: ["l9"] });
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(drawsIn(r.events)).toEqual([top(s, "lio"), top(s, "sae")]);
    untouched(s, r.state, "world");
  });

  it("a side's own opening pick draws as before", () => {
    const rs = withCards(card("l9", 2, EACH_SIDE_DRAWS));
    const s = startGame(2, 1, rs, setupPlus({ lio: ["l9"] }));
    const r = openWith(s, "l9", "s1", rs);
    expect(drawsIn(r.events)).toEqual([top(s, "lio"), top(s, "sae")]);
    untouched(s, r.state, "world");
  });

  it.each(["lio", "sae"] as const)(
    "a neutral event's player draw, %s playing it, comes from that side's deck",
    (player) => {
      const s = startAtPlay();
      const r = startProgram(ruleset, s, [draw("player")], "n1", player);
      if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
      expect(drawsIn(r.value.events)).toEqual([top(s, player)]);
      untouched(s, r.value.state, "world");
    },
  );

  it("a draw outside any card's event draws from the deck it names", () => {
    const s = startAtPlay();
    const r = startProgram(ruleset, s, EACH_SIDE_DRAWS);
    if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
    expect(drawsIn(r.value.events)).toEqual([top(s, "lio"), top(s, "sae")]);
    untouched(s, r.value.state, "world");
  });
});

describe("a rival's opening card that resolves second draws from the World deck", () => {
  it.each([
    // LIO's l1 (3 ops) resolves first; SAE's pick, LIO's card l9 (1 op), second.
    ["LIO's pick first", "l9", { sae: ["l9"] }, ["l1", "l9"], "l1", "lio"],
    // SAE's s1 (3 ops) resolves first; LIO's pick, SAE's card s9 (1 op), second.
    ["SAE's pick first", "s9", { lio: ["s9"] }, ["s9", "s1"], "s1", "sae"],
  ] as const)("%s", (_case, id, extra, [lio, sae], first, owner) => {
    const rs = withCards(card(first, 3), card(id, 1, [draw(owner)]));
    const s = startGame(2, 1, rs, setupPlus(extra));
    const r = openWith(s, lio, sae, rs);
    expect(drawsIn(r.events)).toEqual([top(s, "world")]);
    untouched(s, r.state, owner);
  });

  it.each([
    ["LIO's pick first", "l9", { sae: ["l9"] }, ["l1", "l9"], "l1", "lio"],
    ["SAE's pick first", "s9", { lio: ["s9"] }, ["s9", "s1"], "s1", "sae"],
  ] as const)(
    "%s, pausing on a choose, so the rival's card starts in a later apply call",
    (_case, id, extra, [lio, sae], first, owner) => {
      const rs = withCards(card(first, 3, [choose("go", "lio")]), card(id, 1, [draw(owner)]));
      const s = startGame(2, 1, rs, setupPlus(extra));
      const opened = openWith(s, lio, sae, rs);
      expect(drawsIn(opened.events)).toEqual([]);
      const r = answerYesNo(opened.state, true, rs);
      expect(drawsIn(r.events)).toEqual([top(s, "world")]);
      untouched(s, r.state, owner);
    },
  );
});

describe("a reaction set by a rival's card draws as the card's event does", () => {
  it("SAE plays LIO's card for its points; its cardPlayed trigger fires during LIO's own play and still draws from the World deck", () => {
    const cardPlayed: Step = { op: "trigger", hook: "cardPlayed", do: [draw("lio")], duration: { kind: "turnEnd" } };
    const rs = withCards(card("l9", 2, [cardPlayed]));
    // Two plays each: LIO l2, SAE l9, then LIO's own l3 for its event.
    const s = openWith(startGame(2, 2, rs, setupPlus({ sae: ["l9"] }, 2, 2)), "l1", "s1", rs).state;
    const lioPlayed = applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
    const waiting = applied(lioPlayed, playAnswer(lioPlayed, "sae", "l9", "points"), rs).state;
    const set = applied(waiting, orderAnswer(waiting, "sae", "before"), rs).state;
    expect(set.public.triggers).toMatchObject([{ source: "l9", player: "sae", worldFor: "lio" }]);
    const r = applied(set, playAnswer(set, "lio", "l3", "event"), rs);
    expect(r.events.map((e) => e.kind)).toContain("triggerFired");
    expect(drawsIn(r.events)).toEqual([top(s, "world")]);
    untouched(s, r.state, "lio");
  });
});
