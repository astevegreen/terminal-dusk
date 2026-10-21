// The playedBy condition (#169): an if is true exactly when the side that picked or played the card, as
// recorded on the running program (#117), is the side it names. Each card here runs
// "if playedBy lio { marker a } else { marker b }; if playedBy sae { marker a } else { marker b }",
// so LIO's card records ["a", "b"] and SAE's ["b", "a"].
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./index.ts";
import type { GameEvent, GameState, Ruleset, Side, Step } from "./index.ts";
import {
  answerYesNo,
  applied,
  choose,
  forEach,
  marker,
  markers,
  openWith,
  orderAnswer,
  playAnswer,
  setupPlus,
  sideCard,
  startGame,
  withCards,
} from "./test/game.ts";

const ifPlayedBy = (side: Side, then: Step[], otherwise: Step[]): Step => ({
  op: "if",
  cond: { op: "playedBy", side },
  then,
  else: otherwise,
});
/** Tests LIO, then SAE: "a" when the test is true, "b" when false. */
const BOTH_TESTS: Step[] = [
  ifPlayedBy("lio", [marker("a")], [marker("b")]),
  ifPlayedBy("sae", [marker("a")], [marker("b")]),
];
/** What BOTH_TESTS records when `side` picked or played the card. */
const recorded = (side: Side): string[] => (side === "lio" ? ["a", "b"] : ["b", "a"]);
const trigger = (hook: "turnEnd" | "cardPlayed", steps: Step[]): Step => ({
  op: "trigger",
  hook,
  do: steps,
  duration: { kind: "turnEnd" },
});

/** Answers the first legal answer to each decision until the turn ends; the markers recorded on the way. */
function playOutTurn(state: GameState, rs: Ruleset): string[] {
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
  return markers(events);
}

/** The opening picks [LIO's, SAE's] where only `picker` opens with its neutral card (LIO's n1, SAE's n2). */
const picks = (picker: Side) => (picker === "lio" ? (["n1", "s1"] as const) : (["l1", "n2"] as const));
const neutralOf = (picker: Side) => (picker === "lio" ? "n1" : "n2");

describe("playedBy: a card played for its event or its points", () => {
  it("an LIO card played by LIO for its event: playedBy lio is true, playedBy sae is false", () => {
    const rs = withCards(sideCard("l2", 1, BOTH_TESTS));
    const atPlay = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    expect(markers(applied(atPlay, playAnswer(atPlay, "lio", "l2", "event"), rs).events)).toEqual(recorded("lio"));
  });

  it("the same LIO card played by SAE for its points (the rival's event runs): playedBy sae is true", () => {
    const rs = withCards(sideCard("l9", 1, BOTH_TESTS));
    const s = startGame(2, 1, rs, setupPlus({ sae: ["l9"] }));
    const atPlay = openWith(s, "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "l2", "points"), rs).state;
    const waiting = applied(lioPlayed, playAnswer(lioPlayed, "sae", "l9", "points"), rs).state;
    expect(markers(applied(waiting, orderAnswer(waiting, "sae", "before"), rs).events)).toEqual(recorded("sae"));
  });

  it.each(["lio", "sae"] as const)("a neutral card played by %s for its event: true for that side", (player) => {
    const rs = withCards(sideCard("n1", 1, BOTH_TESTS), sideCard("n2", 1, BOTH_TESTS));
    const atPlay = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", player === "lio" ? "n1" : "l2", "event"), rs);
    const saePlayed = applied(
      lioPlayed.state,
      playAnswer(lioPlayed.state, "sae", player === "sae" ? "n2" : "s2", "event"),
      rs,
    );
    expect(markers([...lioPlayed.events, ...saePlayed.events])).toEqual(recorded(player));
  });
});

describe("playedBy: opening cards", () => {
  it("the LIO card picked as an opening card by SAE: true for SAE only", () => {
    const rs = withCards(sideCard("l9", 1, BOTH_TESTS));
    const s = startGame(2, 1, rs, setupPlus({ sae: ["l9"] }));
    expect(markers(openWith(s, "l1", "l9", rs).events)).toEqual(recorded("sae"));
  });

  it("the LIO card picked as an opening card by LIO: true for LIO only", () => {
    const rs = withCards(sideCard("l1", 1, BOTH_TESTS));
    expect(markers(openWith(startGame(2, 1, rs), "l1", "s1", rs).events)).toEqual(recorded("lio"));
  });

  it.each(["lio", "sae"] as const)(
    "the first opening card (%s's) pauses on a choose, so the second's event starts in a later apply call",
    (first) => {
      const pausing = [choose("go", "lio"), ...BOTH_TESTS];
      const [lioOps, saeOps] = first === "lio" ? [3, 2] : [2, 3];
      const rs = withCards(
        sideCard("n1", lioOps, first === "lio" ? pausing : BOTH_TESTS),
        sideCard("n2", saeOps, first === "sae" ? pausing : BOTH_TESTS),
      );
      const opened = openWith(startGame(2, 1, rs), "n1", "n2", rs);
      expect(markers(opened.events)).toEqual([]);
      const second = first === "lio" ? "sae" : "lio";
      expect(markers(answerYesNo(opened.state, true, rs).events)).toEqual([...recorded(first), ...recorded(second)]);
    },
  );
});

describe("playedBy: inside a trigger's reaction, it reads who played the card that set the trigger", () => {
  it("a card played by SAE sets a turnEnd trigger: at turn end, playedBy sae is true", () => {
    const rs = withCards(sideCard("s2", 1, [trigger("turnEnd", BOTH_TESTS)]));
    const atPlay = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "l2", "points"), rs).state;
    const saePlayed = applied(lioPlayed, playAnswer(lioPlayed, "sae", "s2", "event"), rs);
    expect(saePlayed.state.public.turn).toBe(2);
    expect(markers(saePlayed.events)).toEqual(recorded("sae"));
  });

  it("a cardPlayed trigger set by LIO's card, fired by SAE's later play: playedBy lio is true", () => {
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", BOTH_TESTS)]));
    const atPlay = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    const lioPlayed = applied(atPlay, playAnswer(atPlay, "lio", "l2", "event"), rs);
    expect(markers(lioPlayed.events)).toEqual([]);
    const saePlayed = applied(lioPlayed.state, playAnswer(lioPlayed.state, "sae", "s2", "points"), rs);
    expect(markers(saePlayed.events)).toEqual(recorded("lio"));
  });

  it.each(["lio", "sae"] as const)("a trigger set by an opening card %s picked reads the picker", (picker) => {
    const rs = withCards(sideCard(neutralOf(picker), 1, [trigger("turnEnd", BOTH_TESTS)]));
    const [lio, sae] = picks(picker);
    const opened = openWith(startGame(2, 1, rs), lio, sae, rs);
    expect(opened.state.public.triggers).toMatchObject([{ player: picker }]);
    expect(playOutTurn(opened.state, rs)).toEqual(recorded(picker));
  });

  it.each(["lio", "sae"] as const)(
    "a trigger set by another trigger's reaction reads the player on the trigger that set it (%s picked the card)",
    (picker) => {
      // The opening card sets a cardPlayed trigger; each play (one by each side) fires it, and its reaction
      // sets a turnEnd trigger that runs the tests at turn end: twice, each reading the picker.
      const setsTurnEnd = trigger("cardPlayed", [trigger("turnEnd", BOTH_TESTS)]);
      const rs = withCards(sideCard(neutralOf(picker), 1, [setsTurnEnd]));
      const [lio, sae] = picks(picker);
      const opened = openWith(startGame(2, 1, rs), lio, sae, rs);
      expect(playOutTurn(opened.state, rs)).toEqual([...recorded(picker), ...recorded(picker)]);
    },
  );
});

describe("playedBy: nested in other blocks, it reads the same player", () => {
  // In the then of another if, in the else of another if (for both players, one of the two outer ifs
  // takes each branch), and in a forEach's do.
  const nestedTests: Step[] = [
    ifPlayedBy("lio", BOTH_TESTS, BOTH_TESTS),
    ifPlayedBy("sae", BOTH_TESTS, BOTH_TESTS),
    forEach(["1"], "i", BOTH_TESTS),
  ];

  it.each(["lio", "sae"] as const)("in a card %s picked: every nested test reads the picker", (picker) => {
    const rs = withCards(sideCard(neutralOf(picker), 1, nestedTests));
    const [lio, sae] = picks(picker);
    const r = recorded(picker);
    expect(markers(openWith(startGame(2, 1, rs), lio, sae, rs).events)).toEqual([...r, ...r, ...r]);
  });
});
