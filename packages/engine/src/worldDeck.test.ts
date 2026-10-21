// The World deck (#131; docs/design/contingency-deck.md, "The World deck"): when a side picks or plays the
// rival's card, every draw its event (or a reaction it sets) takes from the rival's own deck comes from the
// shared World deck. Draws it sends to the player's own deck stay there, and nothing else uses the World deck.
import { describe, expect, it } from "vitest";
import type { DeckId, GameEvent, GameState, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import {
  answerYesNo,
  applied,
  choose,
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
  withCards,
} from "./test/game.ts";

const draws = (side: Side | "player", bind: string): Step => ({ op: "drawContingency", side, bind });
/** "Each side draws; the higher number wins": an LIO draw then an SAE draw, both shown as markers. */
const eachSideDraws: Step[] = [draws("lio", "a"), draws("sae", "b"), marker("lio", "a"), marker("sae", "b")];

/** The deck each contingencyDrawn names, in order. */
const drawnFrom = (events: readonly GameEvent[]): DeckId[] =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [e.deck] : []));

/** Expects `deck`'s order and numbers left to be as in `before`. */
function untouched(before: GameState, after: GameState, deck: DeckId): void {
  expect(after.secret.contingency[deck]).toEqual(before.secret.contingency[deck]);
  expect(after.public.contingency[deck]).toEqual(before.public.contingency[deck]);
}

/** A 2-turn, 1-play game opened with l1 and s1 (no events), so LIO's play is open; `extra` joins the hands. */
const atLioPlay = (rs = ruleset, extra: { lio?: string[]; sae?: string[] } = {}): GameState =>
  openWith(startGame(2, 1, rs, setupPlus(extra)), "l1", "s1", rs).state;

/** The state `atLioPlay` reaches once LIO has played l2 for its points, so SAE's play is open. */
function atSaePlay(rs = ruleset, extra: { lio?: string[]; sae?: string[] } = {}): GameState {
  const s = atLioPlay(rs, extra);
  return applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
}

/** `side` plays the rival's card `id` for its points, with its event before the points. */
function playRival(state: GameState, side: Side, id: string, rs = ruleset) {
  const waiting = applied(state, playAnswer(state, side, id, "points"), rs).state;
  return applied(waiting, orderAnswer(waiting, side, "before"), rs);
}

describe("each side draws; the higher number wins, played by the rival", () => {
  it("an LIO card played by SAE for its points draws one World card (for LIO) and one SAE card", () => {
    const rs = withCards(sideCard("l9", 2, eachSideDraws));
    const s = atSaePlay(rs, { sae: ["l9"] });
    const r = playRival(s, "sae", "l9", rs);
    expect(drawnFrom(r.events)).toEqual(["world", "sae"]);
    expect(markers(r.events)).toEqual([`lio:${s.secret.contingency.world[0]}`, `sae:${s.secret.contingency.sae[0]}`]);
    untouched(s, r.state, "lio");
  });

  it("an LIO card picked by SAE as its opening card draws one World card (for LIO) and one SAE card", () => {
    const rs = withCards(sideCard("l9", 2, eachSideDraws));
    const s = startGame(2, 1, rs, setupPlus({ sae: ["l9"] }));
    const r = openWith(s, "l1", "l9", rs);
    expect(drawnFrom(r.events)).toEqual(["world", "sae"]);
    untouched(s, r.state, "lio");
  });

  it("with sides swapped: an SAE card played by LIO for its points draws one LIO card and one World card (for SAE)", () => {
    const rs = withCards(sideCard("s9", 2, eachSideDraws));
    const s = atLioPlay(rs, { lio: ["s9"] });
    const r = playRival(s, "lio", "s9", rs);
    expect(drawnFrom(r.events)).toEqual(["lio", "world"]);
    expect(markers(r.events)).toEqual([`lio:${s.secret.contingency.lio[0]}`, `sae:${s.secret.contingency.world[0]}`]);
    untouched(s, r.state, "sae");
  });

  it("with sides swapped: an SAE card picked by LIO as its opening card draws one LIO card and one World card", () => {
    const rs = withCards(sideCard("s9", 2, eachSideDraws));
    const s = startGame(2, 1, rs, setupPlus({ lio: ["s9"] }));
    const r = openWith(s, "s9", "s1", rs);
    expect(drawnFrom(r.events)).toEqual(["lio", "world"]);
    untouched(s, r.state, "sae");
  });
});

describe("everything else draws exactly as before; the World deck is untouched", () => {
  it("SAE plays its own SAE card that draws from LIO's deck: LIO's deck, not the World deck, is drawn", () => {
    const rs = withCards(sideCard("s9", 2, [draws("lio", "n")]));
    const s = atSaePlay(rs, { sae: ["s9"] });
    const r = applied(s, playAnswer(s, "sae", "s9", "event"), rs);
    expect(drawnFrom(r.events)).toEqual(["lio"]);
    untouched(s, r.state, "world");
  });

  it("a side's own card played for its event draws each side's deck as it names them", () => {
    const rs = withCards(sideCard("l9", 2, eachSideDraws));
    const s = atLioPlay(rs, { lio: ["l9"] });
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(drawnFrom(r.events)).toEqual(["lio", "sae"]);
    untouched(s, r.state, "world");
  });

  it.each(["lio", "sae"] as const)("a neutral event played by %s draws from that side's deck", (player) => {
    const rs = withCards(sideCard("n1", 1, [draws("player", "n")]), sideCard("n2", 1, [draws("player", "n")]));
    const s = player === "lio" ? atLioPlay(rs) : atSaePlay(rs);
    const r = applied(s, playAnswer(s, player, player === "lio" ? "n1" : "n2", "event"), rs);
    expect(drawnFrom(r.events)).toEqual([player]);
    untouched(s, r.state, "world");
  });

  it("a draw outside a card event takes the deck it names", () => {
    const s = startAtPlay();
    const r = startProgram(ruleset, s, [draws("lio", "a"), draws("sae", "b")]);
    if (!r.ok) throw new Error(r.error.code);
    expect(drawnFrom(r.value.events)).toEqual(["lio", "sae"]);
    untouched(s, r.value.state, "world");
  });
});

describe("a rival's opening card that resolves second draws from the World deck for its owner's deck", () => {
  it.each([
    ["SAE picks LIO's l9; LIO's l1 (more ops) resolves first", "sae", "l1", "l9", "lio"],
    ["LIO picks SAE's s9; SAE's s1 (more ops) resolves first", "lio", "s9", "s1", "sae"],
  ] as const)("%s", (_case, _picker, lioPick, saePick, owner) => {
    const first = owner === "lio" ? "l1" : "s1";
    const rival = owner === "lio" ? "l9" : "s9";
    const rs = withCards(sideCard(first, 3, [draws(owner, "a")]), sideCard(rival, 2, [draws(owner, "b")]));
    const s = startGame(2, 1, rs, setupPlus(owner === "lio" ? { sae: ["l9"] } : { lio: ["s9"] }));
    const r = openWith(s, lioPick, saePick, rs);
    expect(drawnFrom(r.events)).toEqual([owner, "world"]);
  });

  it.each(["lio", "sae"] as const)(
    "the first card pauses on a choose, so %s's rival pick starts in a later apply call and still draws the World deck",
    (picker) => {
      const owner = picker === "lio" ? "sae" : "lio";
      const first = owner === "lio" ? "l1" : "s1";
      const rival = owner === "lio" ? "l9" : "s9";
      const rs = withCards(sideCard(first, 3, [choose("go", "lio")]), sideCard(rival, 2, [draws(owner, "b")]));
      const s = startGame(2, 1, rs, setupPlus(picker === "lio" ? { lio: ["s9"] } : { sae: ["l9"] }));
      const opened = openWith(s, picker === "lio" ? "s9" : "l1", picker === "lio" ? "s1" : "l9", rs);
      expect(drawnFrom(opened.events)).toEqual([]);
      const answered = answerYesNo(opened.state, true, rs);
      expect(drawnFrom(answered.events)).toEqual(["world"]);
      untouched(s, answered.state, owner);
    },
  );
});

describe("a reaction set by a rival's card follows the card, not the hook that fires it", () => {
  it("SAE plays LIO's l9 for points; its cardPlayed reaction fires during LIO's own play and still draws the World deck", () => {
    const reaction: Step = {
      op: "trigger",
      hook: "cardPlayed",
      do: [draws("lio", "n")],
      duration: { kind: "turnEnd" },
    };
    const rs = withCards(sideCard("l9", 2, [reaction]));
    // Two plays each: LIO l2, SAE l9 (sets the trigger), then LIO plays its own l3 and the trigger fires.
    const atPlay = openWith(startGame(2, 2, rs, setupPlus({ sae: ["l9"] }, 2, 2)), "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "l2", "points"), rs).state;
    const saePlayed = playRival(lioPlayed, "sae", "l9", rs);
    expect(drawnFrom(saePlayed.events)).toEqual([]);
    const s = saePlayed.state;
    const r = applied(s, playAnswer(s, "lio", "l3", "points"), rs);
    expect(r.events).toContainEqual({ kind: "triggerFired", visibility: "public", source: "l9", hook: "cardPlayed" });
    expect(drawnFrom(r.events)).toEqual(["world"]);
    untouched(s, r.state, "lio");
  });
});
