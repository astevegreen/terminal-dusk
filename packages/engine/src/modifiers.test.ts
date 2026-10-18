// Modifiers (#89): rule changes in public state, the opsValue hook, and their end at the turn's end.
import { describe, expect, it } from "vitest";
import { apply, viewFor } from "./index.ts";
import type { GameEvent, GameState, PlayUse, Ruleset, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  applied,
  choose,
  forEach,
  ifYes,
  openWith,
  orderAnswer,
  playAnswer,
  setupPlus,
  sideCard,
  startAtPlay,
  startGame,
  withCards,
} from "./test/game.ts";

/** A `modifier` step: "opsValue, `side`, `add`, min `min`, until the end of the turn". */
const opsMod = (side: Side | "both", add: number, min?: number): Step => ({
  op: "modifier",
  mod: min === undefined ? { hook: "opsValue", side, add } : { hook: "opsValue", side, add, min },
  duration: { kind: "turnEnd" },
});
/** The points spent, as "side:amount", in order. */
const spent = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "pointsSpent" ? [`${e.side}:${e.amount}`] : []));
/** The modifier and points events, in order, as "started:source", "ended:source" and "points:side:amount". */
const story = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    if (e.kind === "modifierStarted") return [`started:${e.source}`];
    if (e.kind === "modifierEnded") return [`ended:${e.source}`];
    if (e.kind === "pointsSpent") return [`points:${e.side}:${e.amount}`];
    return [];
  });

/** A game of `turns` turns and `plays` plays opened with l1 and s1, so LIO's first play is open. */
const atPlay = (rs: Ruleset, extra: { lio?: string[]; sae?: string[] } = {}, turns = 2, plays = 2): GameState =>
  openWith(startGame(turns, plays, rs, setupPlus(extra, turns, plays)), "l1", "s1", rs).state;
/** `side` plays `card` for `as`, and the answer is expected to be accepted. */
const play = (s: GameState, side: Side, card: string, as: PlayUse, rs: Ruleset) =>
  applied(s, playAnswer(s, side, card, as), rs);
/** `side` plays the rival's `card` for its points, with its event `order` the points. */
const playRival = (s: GameState, side: Side, card: string, order: "before" | "after", rs: Ruleset) => {
  const waiting = play(s, side, card, "points", rs).state;
  return applied(waiting, orderAnswer(waiting, side, order), rs);
};

describe("a modifier step in a card's event", () => {
  it("'opsValue, both, -1, min 1, turnEnd': the next plays for points by either side spend one less, never below 1", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("both", -1, 1)]), sideCard("s2", 3), sideCard("s3", 2));
    const made = play(atPlay(rs), "lio", "l2", "event", rs);
    expect(made.events).toEqual([
      {
        kind: "modifierStarted",
        visibility: "public",
        source: "l2",
        mod: { hook: "opsValue", side: "both", add: -1, min: 1 },
        expires: { kind: "turnEnd", turn: 1 },
      },
    ]);
    expect(made.state.public.modifiers).toEqual([
      { source: "l2", mod: { hook: "opsValue", side: "both", add: -1, min: 1 }, expires: { kind: "turnEnd", turn: 1 } },
    ]);
    const sae = play(made.state, "sae", "s2", "points", rs);
    const lio = play(sae.state, "lio", "l3", "points", rs);
    const sae2 = play(lio.state, "sae", "s3", "points", rs);
    expect([...spent(sae.events), ...spent(lio.events), ...spent(sae2.events)]).toEqual(["sae:2", "lio:1", "sae:1"]);
  });

  it("an opening card's event makes a modifier with that card as its source", () => {
    const rs = withCards(sideCard("l1", 1, [opsMod("lio", 1)]));
    expect(atPlay(rs).public.modifiers).toMatchObject([{ source: "l1" }]);
  });

  it("a modifier with side 'sae' does not change what LIO spends", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("sae", -1)]), sideCard("s2", 3), sideCard("l3", 3));
    const made = play(atPlay(rs), "lio", "l2", "event", rs).state;
    const sae = play(made, "sae", "s2", "points", rs);
    const lio = play(sae.state, "lio", "l3", "points", rs);
    expect([...spent(sae.events), ...spent(lio.events)]).toEqual(["sae:2", "lio:3"]);
  });

  it("a rival's card played for its points: the modifier that applies is the spender's, as spendPoints names the spender", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("lio", 1)]), sideCard("l9", 3), sideCard("s9", 3));
    const made = play(atPlay(rs, { lio: ["s9"], sae: ["l9"] }), "lio", "l2", "event", rs).state;
    const sae = playRival(made, "sae", "l9", "after", rs);
    const lio = playRival(sae.state, "lio", "s9", "before", rs);
    expect([...spent(sae.events), ...spent(lio.events)]).toEqual(["sae:3", "lio:4"]);
  });

  it.each([
    ["before", ["started:l9", "points:sae:1"]],
    ["after", ["points:sae:3", "started:l9"]],
  ] as const)(
    "a rival's card whose own event makes a modifier, with the event %s the points (owner's decision, question 3)",
    (order, expected) => {
      const rs = withCards(sideCard("l2", 1), sideCard("l9", 3, [opsMod("both", -2)]), sideCard("l3", 3));
      const lioFirst = play(atPlay(rs, { sae: ["l9"] }), "lio", "l2", "points", rs).state;
      const sae = playRival(lioFirst, "sae", "l9", order, rs);
      expect(story(sae.events)).toEqual(expected);
      // Either way the modifier applies to the next play.
      expect(spent(play(sae.state, "lio", "l3", "points", rs).events)).toEqual(["lio:1"]);
    },
  );

  it("a modifier made inside an if branch and inside a forEach body has the card as its source", () => {
    const effect = [choose("a", "lio"), ifYes("a", [opsMod("both", 1)]), forEach(["x", "y"], "i", [opsMod("sae", -1)])];
    const rs = withCards(sideCard("l2", 1, effect));
    const paused = play(atPlay(rs), "lio", "l2", "event", rs).state;
    const done = answerYesNo(paused, true, rs).state;
    expect(done.public.modifiers.map((m) => m.source)).toEqual(["l2", "l2", "l2"]);
  });

  it("an add below the ops with no min spends 0, never a negative number", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("both", -2)]), sideCard("s2", 1));
    const made = play(atPlay(rs), "lio", "l2", "event", rs).state;
    expect(spent(play(made, "sae", "s2", "points", rs).events)).toEqual(["sae:0"]);
  });

  it.each([
    ["'-2, min 2' then '-1'", [opsMod("both", -2, 2), opsMod("both", -1)], "sae:1"],
    ["'-1' then '-2, min 2'", [opsMod("both", -1), opsMod("both", -2, 2)], "sae:2"],
  ])(
    "two modifiers combine in the order made, each min on the running value (owner's decision, question 2): %s",
    (_order, effect, expected) => {
      const rs = withCards(sideCard("l2", 1, effect), sideCard("s2", 3));
      const made = play(atPlay(rs), "lio", "l2", "event", rs).state;
      expect(spent(play(made, "sae", "s2", "points", rs).events)).toEqual([expected]);
    },
  );
});

describe("a modifier's end", () => {
  it("at the turn's end the modifiers are gone, each ended once in order, and the next turn spends printed ops", () => {
    const rs = withCards(
      sideCard("l2", 1, [opsMod("both", -1), opsMod("sae", 1)]),
      sideCard("s2", 3),
      sideCard("l4", 3),
    );
    const made = play(atPlay(rs, {}, 2, 1), "lio", "l2", "event", rs).state;
    const end = play(made, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual(["points:sae:3", "ended:l2", "ended:l2"]);
    expect(end.events.filter((e) => e.kind === "modifierEnded")).toEqual([
      { kind: "modifierEnded", visibility: "public", source: "l2", mod: { hook: "opsValue", side: "both", add: -1 } },
      { kind: "modifierEnded", visibility: "public", source: "l2", mod: { hook: "opsValue", side: "sae", add: 1 } },
    ]);
    expect(end.state.public.turn).toBe(2);
    expect(end.state.public.modifiers).toEqual([]);
    const opened = openWith(end.state, "l3", "s3", rs).state;
    expect(spent(play(opened, "lio", "l4", "points", rs).events)).toEqual(["lio:3"]);
  });

  it("on the last turn the modifierEnded events come before the game is over, and the final state has none", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("both", -1)]), sideCard("s2", 3));
    const made = play(atPlay(rs, {}, 1, 1), "lio", "l2", "event", rs).state;
    const end = play(made, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual(["points:sae:2", "ended:l2"]);
    expect(end.state.public.status.kind).toBe("over");
    expect(end.state.public.modifiers).toEqual([]);
  });
});

describe("modifiers are public", () => {
  it("every viewer's view shows the modifiers in force", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod("both", -1, 1)]));
    const s = play(atPlay(rs), "lio", "l2", "event", rs).state;
    expect(s.public.modifiers).toHaveLength(1);
    for (const viewer of ["lio", "sae", "spectator", "omniscient"] as const) {
      expect(viewFor(s, viewer).public.modifiers).toEqual(s.public.modifiers);
    }
  });
});

describe("apply with a modifier", () => {
  it("never changes deep-frozen inputs when a played card's event makes a modifier", () => {
    const rs = deepFreeze(withCards(sideCard("l2", 1, [opsMod("both", -1, 1)])));
    const s = deepFreeze(atPlay(rs));
    const before = JSON.stringify(s);
    const r = apply(rs, s, playAnswer(s, "lio", "l2", "event"));
    expect(r.ok && r.value.state.public.modifiers).toHaveLength(1);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("a modifier step's source comes from its program, never from the cards in play", () => {
  it("a program no card started cannot make a modifier: invalidProgram", () => {
    const r = startProgram(withCards(), startAtPlay(), [opsMod("both", 1)]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });
  it("a program started for a card makes it with that card as the source", () => {
    const r = startProgram(withCards(), startAtPlay(), [opsMod("both", 1)], "z1");
    expect(r.ok && r.value.state.public.modifiers.map((m) => m.source)).toEqual(["z1"]);
  });
});
