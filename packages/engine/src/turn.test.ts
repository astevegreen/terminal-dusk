// The turn structure (#35): secret opening cards, their events in order, then alternating plays.
// How a play uses its card is in play.test.ts (#36).
import { describe, expect, it } from "vitest";
import { apply, legalAnswers, viewFor } from "./index.ts";
import type { GameState, Ruleset, Side } from "./index.ts";
import {
  accepted,
  answerYesNo,
  asks,
  cardAnswer,
  marker,
  markers,
  openWith,
  playAnswer,
  playAnswers,
  ruleset,
  setupPlus,
  sideCard as card,
  startGame,
  withCards,
} from "./test/game.ts";

const cardsOf = (rs: Ruleset, state: GameState, side: Side): string[] =>
  legalAnswers(rs, state, side).map((v) => ("card" in v ? v.card : "?"));

describe("the opening pick", () => {
  it("each turn opens with a simultaneous chooseCard pair whose options say any non-neutral card in your hand", () => {
    const s = startGame();
    const options = { from: "hand", includeNeutral: false };
    expect(s.public.pending).toEqual([
      { id: "d0-lio", side: "lio", kind: "chooseCard", options, simultaneousGroup: "g0" },
      { id: "d0-sae", side: "sae", kind: "chooseCard", options, simultaneousGroup: "g0" },
    ]);
  });
  it("the opening pick's options never list card IDs", () => {
    const s = startGame();
    const pending = JSON.stringify(s.public.pending);
    for (const id of [...s.private.lio.hand, ...s.private.sae.hand]) expect(pending).not.toContain(`"${id}"`);
  });
  it("legalAnswers lists that side's non-neutral cards, in hand order", () => {
    const s = startGame();
    expect(legalAnswers(ruleset, s, "lio")).toEqual(
      ["l1", "l2", "l3", "l4"].map((c) => ({ kind: "chooseCard", card: c })),
    );
    expect(cardsOf(ruleset, s, "sae")).toEqual(["s1", "s2", "s3", "s4"]);
  });
  it("a neutral card is never an opening pick, but in the same game it is a legal play for its points", () => {
    const s = startGame();
    expect(cardsOf(ruleset, s, "lio")).not.toContain("n1");
    const neutralOpening = { ...cardAnswer(s, "lio"), value: { kind: "chooseCard" as const, card: "n1" } };
    expect(apply(ruleset, s, neutralOpening)).toMatchObject({ ok: false, error: { code: "illegalAnswer" } });
    const atPlay = openWith(s, "l1", "s1").state;
    expect(cardsOf(ruleset, atPlay, "lio")).toContain("n1");
    const played = accepted(atPlay, playAnswer(atPlay, "lio", "n1", "points"));
    expect(played.public.discard.at(-1)).toBe("n1");
  });
  it("a pick stays in its owner's hand until both are in", () => {
    const half = accepted(startGame(), cardAnswer(startGame(), "lio", "l2"));
    expect(half.private.lio.hand).toContain("l2");
    expect(half.public.inPlay).toEqual([]);
    expect(half.public.discard).toEqual([]);
  });
  it("neither opening pick appears in the other side's view or the spectator view until both are in", () => {
    for (const [first, pick, rival] of [
      ["lio", "l3", "sae"],
      ["sae", "s3", "lio"],
    ] as const) {
      const r = apply(ruleset, startGame(), cardAnswer(startGame(), first, pick));
      if (!r.ok) throw new Error("pick rejected");
      expect(r.value.events).toEqual([]);
      for (const viewer of [rival, "spectator"] as const) {
        expect(JSON.stringify(viewFor(r.value.state, viewer))).not.toContain(`"${pick}"`);
      }
    }
  });
});

describe("where the opening cards are, and the order their events resolve in", () => {
  it("both in inPlay while the first event waits; the first in the discard pile while the second waits; then none", () => {
    const rs = withCards(card("l1", 3, asks("lio", "l1")), card("s1", 2, asks("sae", "s1")));
    const first = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    expect(first.public.inPlay).toEqual(["l1", "s1"]);
    expect(first.private.lio.hand).not.toContain("l1");
    expect(first.private.sae.hand).not.toContain("s1");
    expect(first.public.pending).toMatchObject([{ side: "lio", kind: "yesNo" }]);
    const second = answerYesNo(first, true, rs).state;
    expect(second.public.discard.at(-1)).toBe("l1");
    expect(second.public.inPlay).toEqual(["s1"]);
    expect(second.public.pending).toMatchObject([{ side: "sae", kind: "yesNo" }]);
    const after = answerYesNo(second, false, rs).state;
    expect(after.public.inPlay).toEqual([]);
    expect(after.public.discard).toEqual(["l1", "s1"]);
  });
  it.each([
    ["SAE's card has more ops", 2, 3, ["s1", "l1"]],
    ["LIO's card has more ops", 3, 2, ["l1", "s1"]],
    ["a tie: the card LIO picked goes first", 2, 2, ["l1", "s1"]],
  ])("events only, more ops first: %s", (_case, lioOps, saeOps, order) => {
    const rs = withCards(card("l1", lioOps, [marker("l1")]), card("s1", saeOps, [marker("s1")]));
    const { state, events } = openWith(startGame(2, 1, rs), "l1", "s1", rs);
    expect(markers(events)).toEqual(order);
    expect(state.public.discard).toEqual(order);
  });
  it("a tie where LIO opened with an SAE card: LIO's pick still goes first", () => {
    const rs = withCards(card("s9", 2, [marker("s9")]), card("s1", 2, [marker("s1")]));
    const s = startGame(2, 1, rs, setupPlus({ lio: ["s9"] }));
    expect(markers(openWith(s, "s9", "s1", rs).events)).toEqual(["s9", "s1"]);
  });
});

describe("a side may open with its rival's card, and each choice goes to the side the card names", () => {
  it.each([
    ["SAE opens with an LIO card whose choice is LIO's", "sae", "l9", "lio"],
    ["LIO opens with an SAE card whose choice is SAE's", "lio", "s9", "sae"],
    ["SAE opens with an LIO card whose choice is SAE's", "sae", "l9", "sae"],
  ] as const)("%s: the choice goes to %s", (_case, opener, rivalCard, chooser) => {
    const rs = withCards(card(rivalCard, 3, asks(chooser, "event")));
    const s = startGame(2, 1, rs, setupPlus({ [opener]: [rivalCard] }));
    const picks = { lio: "l1", sae: "s1", [opener]: rivalCard };
    const paused = openWith(s, picks.lio, picks.sae, rs).state;
    expect(paused.public.inPlay[0]).toBe(rivalCard);
    expect(paused.public.pending).toMatchObject([{ side: chooser, kind: "yesNo" }]);
  });
});

describe("plays after the opening cards", () => {
  it("LIO plays, then SAE, alternating until each side has made playsPerTurn plays", () => {
    let s = openWith(startGame(1, 2), "l1", "s1").state;
    const sides: Side[] = [];
    while (s.public.status.kind === "active") {
      const d = s.public.pending[0]!;
      expect(d.kind).toBe("playCardAs");
      sides.push(d.side);
      s = accepted(s, cardAnswer(s, d.side));
    }
    expect(sides).toEqual(["lio", "sae", "lio", "sae"]);
  });
  it("a play offers every card in your hand", () => {
    const s = openWith(startGame(), "l1", "s1").state;
    expect(new Set(cardsOf(ruleset, s, "lio"))).toEqual(new Set(s.private.lio.hand));
  });
});

describe("turns and the end of the game", () => {
  it("turn is 1 in the first turn and goes up by one as each new turn starts", () => {
    // Each turn: 2 opening picks, then 1 play each.
    let s = startGame(3, 1);
    const turnsSeen: number[] = [];
    for (let t = 0; t < 3; t++) {
      expect(s.public.pending.map((d) => d.kind)).toEqual(["chooseCard", "chooseCard"]);
      turnsSeen.push(s.public.turn);
      s = playAnswers(s, 4);
    }
    expect(turnsSeen).toEqual([1, 2, 3]);
  });
  it("after the setup's number of turns the game is over: turnLimitReached, winner null", () => {
    const s = playAnswers(startGame(2, 1), 8);
    expect(s.public.status).toEqual({ kind: "over", winner: null, reason: "turnLimitReached" });
    expect(s.public.pending).toEqual([]);
    expect(s.public.turn).toBe(2);
    expect(legalAnswers(ruleset, s, "lio")).toEqual([]);
  });
});
