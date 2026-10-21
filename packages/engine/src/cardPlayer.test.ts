// Who picked or played a card (#117; docs/design/contingency-deck.md, "Whose deck"): the engine records it for
// every card's event, opening picks included, so a neutral event's "player" draws, and those of the triggers it
// sets, come from the deck of the side that picked or played it. Each draw here is four draws from a deck of
// six, so the fourth also reshuffles that deck: both events must name the picker, and the other deck stays as it was.
import { describe, expect, it } from "vitest";
import { legalAnswers, viewFor } from "./index.ts";
import type { GameEvent, GameState, Ruleset, Side, Step } from "./index.ts";
import { otherSide } from "./types.ts";
import {
  answerYesNo,
  applied,
  choose,
  forEach,
  openWith,
  orderAnswer,
  playAnswer,
  setupPlus,
  sideCard as card,
  startGame,
  withCards,
} from "./test/game.ts";

/** Four draws: the fourth leaves two cards, so the deck is reshuffled (#130). */
const drawsFrom = (side: Side | "player"): Step =>
  forEach(["1", "2", "3", "4"], "i", [{ op: "drawContingency", side }]);
const DRAW_PLAYER = drawsFrom("player");
const ONE_DECK = ["drawn", "drawn", "drawn", "drawn", "reshuffled"];
const turnEnd = (steps: Step[]): Step => ({ op: "trigger", hook: "turnEnd", do: steps, duration: { kind: "turnEnd" } });

/** The side each contingencyDrawn and contingencyDeckReshuffled names, in order, as "drawn:lio" and so on. */
const deckEvents = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    if (e.kind === "contingencyDrawn") return [`drawn:${e.side}`];
    return e.kind === "contingencyDeckReshuffled" ? [`reshuffled:${e.side}`] : [];
  });
/** ONE_DECK for `side`'s deck. */
const fromDeck = (side: Side): string[] => ONE_DECK.map((what) => `${what}:${side}`);

/** Expects `side`'s Contingency deck, its order and the numbers left, to be as in `before`. */
function untouched(before: GameState, after: GameState, side: Side): void {
  expect(after.secret.contingency[side]).toEqual(before.secret.contingency[side]);
  expect(after.public.contingency[side]).toEqual(before.public.contingency[side]);
}

/** Answers the first legal answer to each decision until the turn ends, collecting every event. */
function playOutTurn(state: GameState, rs: Ruleset): { state: GameState; events: GameEvent[] } {
  const turn = state.public.turn;
  const events: GameEvent[] = [];
  let s = state;
  while (s.public.turn === turn && s.public.status.kind === "active") {
    const d = s.public.pending[0];
    if (!d) throw new Error("no decision pending");
    const r = applied(s, { decisionId: d.id, side: d.side, value: legalAnswers(rs, s, d.side)[0]! }, rs);
    events.push(...r.events);
    s = r.state;
  }
  return { state: s, events };
}

/** The opening picks [LIO's, SAE's] where only `picker` opens with its neutral card (LIO n1, SAE n2). */
const picks = (picker: Side) => (picker === "lio" ? (["n1", "s1"] as const) : (["l1", "n2"] as const));

describe("a neutral opening card draws from the deck of the side that picked it", () => {
  it.each(["lio", "sae"] as const)("%s picks it, and %s's deck is drawn", (picker) => {
    const neutral = picker === "lio" ? "n1" : "n2";
    const rs = withCards(card(neutral, 2, [DRAW_PLAYER]));
    const s = startGame(2, 1, rs);
    const [lio, sae] = picks(picker);
    const r = openWith(s, lio, sae, rs);
    expect(deckEvents(r.events)).toEqual(fromDeck(picker));
    untouched(s, r.state, otherSide(picker));
  });
});

describe("both opening cards neutral: each card's draws are its own picker's", () => {
  it.each([
    ["SAE's pick first (more ops)", 2, 3, "sae"],
    ["LIO's pick first (more ops)", 3, 2, "lio"],
    ["equal ops: LIO's pick first, as a tie is ordered", 2, 2, "lio"],
  ] as const)("%s", (_case, lioOps, saeOps, first) => {
    const rs = withCards(card("n1", lioOps, [DRAW_PLAYER]), card("n2", saeOps, [DRAW_PLAYER]));
    const r = openWith(startGame(2, 1, rs), "n1", "n2", rs);
    expect(deckEvents(r.events)).toEqual([...fromDeck(first), ...fromDeck(otherSide(first))]);
  });

  it.each(["lio", "sae"] as const)(
    "the first card (%s's) pauses on a choose, so the second starts in a later apply call",
    (first) => {
      const pausing = [DRAW_PLAYER, choose("go", "lio")];
      const [lioOps, saeOps] = first === "lio" ? [3, 2] : [2, 3];
      const rs = withCards(
        card("n1", lioOps, first === "lio" ? pausing : [DRAW_PLAYER]),
        card("n2", saeOps, first === "sae" ? pausing : [DRAW_PLAYER]),
      );
      const s = startGame(2, 1, rs);
      const opened = openWith(s, "n1", "n2", rs);
      expect(deckEvents(opened.events)).toEqual(fromDeck(first));
      expect(opened.state.public.inPlayBy).toEqual([first, otherSide(first)]);
      const second = otherSide(first);
      const before = opened.state;
      const answered = answerYesNo(before, true, rs);
      expect(deckEvents(answered.events)).toEqual(fromDeck(second));
      untouched(before, answered.state, first);
    },
  );

  it("the record of who picked each card in play is public: every viewer sees it", () => {
    const rs = withCards(card("n1", 3, [choose("go", "lio")]), card("n2", 2, [DRAW_PLAYER]));
    const paused = openWith(startGame(2, 1, rs), "n1", "n2", rs).state;
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(viewFor(paused, viewer).public.inPlayBy).toEqual(["lio", "sae"]);
    }
  });
});

describe("a trigger a neutral opening card sets draws from its picker's deck", () => {
  it.each(["lio", "sae"] as const)("%s picks the card; its turnEnd reaction draws from %s's deck", (picker) => {
    const neutral = picker === "lio" ? "n1" : "n2";
    const rs = withCards(card(neutral, 2, [turnEnd([DRAW_PLAYER])]));
    const s = startGame(2, 1, rs);
    const [lio, sae] = picks(picker);
    const opened = openWith(s, lio, sae, rs);
    expect(opened.state.public.triggers).toMatchObject([{ source: neutral, player: picker }]);
    const turn = playOutTurn(opened.state, rs);
    expect(deckEvents(turn.events)).toEqual(fromDeck(picker));
    untouched(s, turn.state, otherSide(picker));
  });
});

describe("a cardPlayed trigger a neutral card sets draws from its player's deck while another card is in play", () => {
  it("LIO plays n1 for its event; its reaction to SAE's play draws from LIO's deck", () => {
    const cardPlayed: Step = { op: "trigger", hook: "cardPlayed", do: [DRAW_PLAYER], duration: { kind: "turnEnd" } };
    const rs = withCards(card("n1", 1, [cardPlayed]));
    const s = startGame(2, 1, rs);
    const atPlay = openWith(s, "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "n1", "event"), rs).state;
    const saePlayed = applied(lioPlayed, playAnswer(lioPlayed, "sae", "s2", "points"), rs);
    expect(deckEvents(saePlayed.events)).toEqual(fromDeck("lio"));
    untouched(s, saePlayed.state, "sae");
  });
});

describe("an LIO card picked or played by SAE records SAE, and still draws from the deck it names", () => {
  // l9's event sets a turnEnd trigger whose reaction draws from LIO's deck.
  const rs = withCards(card("l9", 2, [turnEnd([drawsFrom("lio")])]));

  it("picked by SAE as its opening card", () => {
    const s = startGame(2, 1, rs, setupPlus({ sae: ["l9"] }));
    const opened = openWith(s, "l1", "l9", rs);
    expect(opened.state.public.triggers).toMatchObject([{ source: "l9", player: "sae" }]);
    const turn = playOutTurn(opened.state, rs);
    expect(deckEvents(turn.events)).toEqual(fromDeck("lio"));
    untouched(s, turn.state, "sae");
  });

  it("played by SAE for its points", () => {
    // Two plays each, so the trigger is still waiting after SAE's first play.
    const s = startGame(2, 2, rs, setupPlus({ sae: ["l9"] }, 2, 2));
    const atPlay = openWith(s, "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "l2", "points"), rs).state;
    const waiting = applied(lioPlayed, playAnswer(lioPlayed, "sae", "l9", "points"), rs).state;
    expect(waiting.public.inPlayBy).toEqual(["sae"]);
    const ran = applied(waiting, orderAnswer(waiting, "sae", "before"), rs).state;
    expect(ran.public.triggers).toMatchObject([{ source: "l9", player: "sae" }]);
    const turn = playOutTurn(ran, rs);
    expect(deckEvents(turn.events)).toEqual(fromDeck("lio"));
    untouched(s, turn.state, "sae");
  });
});

describe("a card played for its points with no event records nothing", () => {
  // LIO's n1 sets a cardPlayed trigger that pauses on a choose, so SAE's card is still in play when read.
  const pauseOnPlay: Step = {
    op: "trigger",
    hook: "cardPlayed",
    do: [choose("go", "lio")],
    duration: { kind: "turnEnd" },
  };
  const rs = withCards(card("n1", 1, [pauseOnPlay]), card("n2", 1, []));

  it.each([
    ["SAE's own card for its points", "s2", "points", null],
    ["a neutral card for its points", "n2", "points", null],
    ["a neutral card for its event", "n2", "event", "sae"],
  ] as const)("SAE plays %s", (_case, played, as, recorded) => {
    const s = startGame(2, 1, rs);
    const atPlay = openWith(s, "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "n1", "event"), rs).state;
    const paused = applied(lioPlayed, playAnswer(lioPlayed, "sae", played, as), rs).state;
    expect(paused.public.inPlay).toEqual([played]);
    expect(paused.public.inPlayBy).toEqual([recorded]);
  });
});
