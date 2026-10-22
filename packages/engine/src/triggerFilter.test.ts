// A trigger's filter and once (#189): a trigger that reacts only to one side's plays, or only while a
// lasting marker is set, and a trigger that fires at most once.
import { describe, expect, it } from "vitest";
import { apply } from "./index.ts";
import type { CardId, GameEvent, GameState, HookId, PlayUse, Ruleset, Side, Step, TriggerFilter } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  applied,
  choose,
  marker,
  openWith,
  playAnswer,
  setupPlus,
  sideCard,
  startGame,
  withCards,
} from "./test/game.ts";

/** A `trigger` step on `hook`, running `reaction` until the turn's end, with `extra` fields (filter, once). */
const trigger = (hook: HookId, reaction: Step[], extra: { filter?: TriggerFilter; once?: true } = {}): Step => ({
  op: "trigger",
  hook,
  ...extra,
  do: reaction,
  duration: { kind: "turnEnd" },
});
const lasting = (label: string): Step => ({ op: "marker", label, lasting: true });
const has = (label: string): TriggerFilter => ({ op: "has", marker: label });
const playedBy = (side: Side): TriggerFilter => ({ op: "playedBy", side });

/** The trigger events and markers, in order. */
const story = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    if (e.kind === "triggerSet" || e.kind === "triggerFired" || e.kind === "triggerEnded") {
      return [[e.kind, e.source, e.hook].join(":")];
    }
    if (e.kind === "marker") return [e.value === undefined ? e.label : [e.label, String(e.value)].join(":")];
    return [];
  });

/** A game of `turns` turns and `plays` plays per side opened with l1 and s1, so LIO's first play is open. */
const atPlay = (rs: Ruleset, turns = 2, plays = 2): GameState =>
  openWith(startGame(turns, plays, rs, setupPlus({}, turns, plays)), "l1", "s1", rs).state;
type Play = [Side, CardId, PlayUse];
/** Makes `plays` in order from `state`: the story of each play, and the state after the last. */
function playAll(state: GameState, plays: readonly Play[], rs: Ruleset): { stories: string[][]; state: GameState } {
  let s = state;
  const stories = plays.map(([side, card, as]) => {
    const r = applied(s, playAnswer(s, side, card, as), rs);
    s = r.state;
    return story(r.events);
  });
  return { stories, state: s };
}
/** Which of the stories hold a triggerFired from `source`, by index. */
const firedIn = (stories: string[][], source: CardId): number[] =>
  stories.flatMap((st, i) => (st.includes(`triggerFired:${source}:cardPlayed`) ? [i] : []));

describe("a cardPlayed trigger filtered on playedBy", () => {
  // Turn 1 has four plays: LIO, SAE, LIO, SAE. The setter's card is played for its event at the setter's
  // first play (LIO's play 0 or SAE's play 1); the others are played for points.
  const cases = [
    ["an LIO card", "l2", "lio"],
    ["an SAE card", "s2", "sae"],
    ["a neutral card played by LIO", "n1", "lio"],
    ["a neutral card played by SAE", "n2", "sae"],
  ] as const;
  const plays = (card: CardId, setter: Side): Play[] => [
    ["lio", setter === "lio" ? card : "l3", setter === "lio" ? "event" : "points"],
    ["sae", setter === "sae" ? card : "s3", setter === "sae" ? "event" : "points"],
    ["lio", "l4", "points"],
    ["sae", "s4", "points"],
  ];

  it.each(
    cases.flatMap(([what, card, setter]) => (["lio", "sae"] as const).map((f) => [what, f, card, setter] as const)),
  )("%s's trigger filtered playedBy %s fires after that side's later plays only", (_what, filterSide, card, setter) => {
    const rs = withCards(
      sideCard(card, 1, [trigger("cardPlayed", [marker("fired")], { filter: playedBy(filterSide) })]),
    );
    const { stories } = playAll(atPlay(rs), plays(card, setter), rs);
    const later = setter === "lio" ? [1, 2, 3] : [2, 3];
    const bySide = later.filter((i) => (i % 2 === 0 ? "lio" : "sae") === filterSide);
    expect(firedIn(stories, card)).toEqual(bySide);
    // A play the filter refuses emits nothing about the trigger (the turn's last play also ends the turn,
    // which ends the trigger as always), and it keeps waiting.
    for (const i of later.filter((j) => !bySide.includes(j))) {
      const told = stories[i]!.filter((line) => line.startsWith("trigger") || line === "fired");
      expect(told).toEqual(i === 3 ? [`triggerEnded:${card}:cardPlayed`] : []);
    }
  });

  it("a reaction whose do holds an if on playedBy still reads the side that played the trigger's card", () => {
    const reaction: Step[] = [{ op: "if", cond: playedBy("lio"), then: [marker("lio")], else: [marker("sae")] }];
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", reaction, { filter: playedBy("sae") })]));
    const { stories } = playAll(
      atPlay(rs),
      [
        ["lio", "l2", "event"],
        ["sae", "s2", "points"],
      ],
      rs,
    );
    expect(stories[1]).toEqual(["triggerFired:l2:cardPlayed", "lio"]);
  });
});

describe("a cardPlayed trigger filtered on has", () => {
  it("fires when the lasting marker is set and not when it is not", () => {
    const rs = withCards(
      sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")], { filter: has("x") })]),
      sideCard("s2", 1, [lasting("x")]),
    );
    const plays: Play[] = [
      ["lio", "l2", "event"],
      ["sae", "s3", "points"],
      ["lio", "l3", "points"],
      ["sae", "s2", "event"],
    ];
    const { stories } = playAll(atPlay(rs), plays, rs);
    expect(stories[1]).toEqual([]);
    expect(stories[2]).toEqual([]);
    expect(stories[3]!.slice(0, 3)).toEqual(["x", "triggerFired:l2:cardPlayed", "fired"]);
  });

  it("filters are tested before any reaction runs: a first reaction setting the marker does not fire the second", () => {
    // Opening l1 and s1 (1 op each, so l1 first) set both triggers; opening cards never fire the hook.
    const rs = withCards(
      sideCard("l1", 1, [trigger("cardPlayed", [lasting("x")])]),
      sideCard("s1", 1, [trigger("cardPlayed", [marker("second")], { filter: has("x") })]),
    );
    const { stories } = playAll(
      atPlay(rs),
      [
        ["lio", "l2", "points"],
        ["sae", "s2", "points"],
      ],
      rs,
    );
    expect(stories[0]).toEqual(["triggerFired:l1:cardPlayed", "x"]);
    expect(stories[1]).toEqual(["triggerFired:l1:cardPlayed", "triggerFired:s1:cardPlayed", "x", "second"]);
  });
});

describe("a turnEnd trigger filtered on has", () => {
  const rs = withCards(
    sideCard("l2", 1, [trigger("turnEnd", [marker("end", "turn")], { filter: has("x") })]),
    sideCard("s2", 1, [lasting("x")]),
  );

  it("fires when the marker is set", () => {
    const { stories, state } = playAll(
      atPlay(rs, 2, 1),
      [
        ["lio", "l2", "event"],
        ["sae", "s2", "event"],
      ],
      rs,
    );
    expect(stories[1]).toEqual(["x", "triggerFired:l2:turnEnd", "end:1"]);
    expect(state.public).toMatchObject({ turn: 2, triggers: [] });
  });

  it("when it is not, emits triggerEnded instead and is gone after the turn ends", () => {
    const { stories, state } = playAll(
      atPlay(rs, 2, 1),
      [
        ["lio", "l2", "event"],
        ["sae", "s3", "points"],
      ],
      rs,
    );
    expect(stories[1]).toEqual(["triggerEnded:l2:turnEnd"]);
    expect(state.public).toMatchObject({ turn: 2, triggers: [] });
  });
});

describe("a once trigger", () => {
  it("fires after the first later play and not after the second, and leaves no triggerEnded", () => {
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")], { once: true })]));
    const plays: Play[] = [
      ["lio", "l2", "event"],
      ["sae", "s2", "points"],
      ["lio", "l3", "points"],
      ["sae", "s3", "points"],
    ];
    const { stories } = playAll(atPlay(rs), plays, rs);
    expect(stories[1]).toEqual(["triggerFired:l2:cardPlayed", "fired"]);
    expect(stories[2]).toEqual([]);
    expect(stories[3]).toEqual([]);
  });

  it("leaves the list when it fires, before its reaction runs", () => {
    const rs = withCards(
      sideCard("l2", 1, [trigger("cardPlayed", [choose("ok", "sae"), marker("ok", "ok")], { once: true })]),
    );
    const { state } = playAll(
      atPlay(rs),
      [
        ["lio", "l2", "event"],
        ["sae", "s2", "points"],
      ],
      rs,
    );
    expect(state.public.pending).toMatchObject([{ side: "sae", kind: "yesNo" }]);
    expect(state.public.triggers).toEqual([]);
    expect(story(answerYesNo(state, true, rs, "sae").events)).toEqual(["ok:true"]);
  });

  it("with a filter, fires on the first matching play, not the first play", () => {
    const rs = withCards(
      sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")], { filter: playedBy("lio"), once: true })]),
    );
    const plays: Play[] = [
      ["lio", "l2", "event"],
      ["sae", "s2", "points"],
      ["lio", "l3", "points"],
      ["sae", "s3", "points"],
    ];
    const { stories } = playAll(atPlay(rs), plays, rs);
    expect(firedIn(stories, "l2")).toEqual([2]);
    expect(stories[3]).toEqual([]);
  });

  it("that never fires ends at the turn's end with triggerEnded", () => {
    const rs = withCards(
      sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")], { filter: playedBy("lio"), once: true })]),
    );
    const { stories, state } = playAll(
      atPlay(rs, 2, 1),
      [
        ["lio", "l2", "event"],
        ["sae", "s2", "points"],
      ],
      rs,
    );
    expect(stories[1]).toEqual(["triggerEnded:l2:cardPlayed"]);
    expect(state.public.triggers).toEqual([]);
  });
});

describe("the stored trigger", () => {
  it("carries filter and once, copied so it shares nothing with the card data", () => {
    const step = trigger("cardPlayed", [marker("fired")], { filter: playedBy("sae"), once: true });
    const rs = withCards(sideCard("l2", 1, [step]));
    const { state } = playAll(atPlay(rs), [["lio", "l2", "event"]], rs);
    const [stored] = state.public.triggers;
    expect(stored).toMatchObject({ source: "l2", filter: { op: "playedBy", side: "sae" }, once: true });
    expect(stored!.filter).not.toBe((step as Extract<Step, { op: "trigger" }>).filter);
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
  });

  it("a trigger without filter or once stores neither", () => {
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")])]));
    const { state } = playAll(atPlay(rs), [["lio", "l2", "event"]], rs);
    expect(Object.keys(state.public.triggers[0]!)).not.toContain("filter");
    expect(Object.keys(state.public.triggers[0]!)).not.toContain("once");
  });
});

describe("apply with a filtered or once trigger", () => {
  it.each([
    ["a filtered trigger", { filter: playedBy("sae") }],
    ["a once trigger", { once: true as const }],
  ])("never changes deep-frozen inputs when %s fires", (_what, extra) => {
    const rs = deepFreeze(withCards(sideCard("l2", 1, [trigger("cardPlayed", [marker("fired")], extra)])));
    const set = playAll(atPlay(rs), [["lio", "l2", "event"]], rs).state;
    const s = deepFreeze(set);
    const before = JSON.stringify(s);
    const r = apply(rs, s, playAnswer(s, "sae", "s2", "points"));
    expect(r.ok && story(r.value.events)).toContain("triggerFired:l2:cardPlayed");
    expect(JSON.stringify(s)).toBe(before);
  });
});
