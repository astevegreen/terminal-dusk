// Triggers (#90): reactions a card leaves behind, fired at the cardPlayed and turnEnd hooks.
import { describe, expect, it } from "vitest";
import { apply, viewFor } from "./index.ts";
import type { GameEvent, GameState, HookId, PlayUse, Ruleset, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  applied,
  choose,
  forEach,
  marker,
  openWith,
  orderAnswer,
  playAnswer,
  setupPlus,
  sideCard,
  startAtPlay,
  startGame,
  withCards,
} from "./test/game.ts";

/** A `trigger` step: on `hook`, run `reaction`, until the end of the turn. */
const trigger = (hook: HookId, reaction: Step[]): Step => ({
  op: "trigger",
  hook,
  do: reaction,
  duration: { kind: "turnEnd" },
});
const opsMod: Step = {
  op: "modifier",
  mod: { hook: "opsValue", side: "both", add: -1 },
  duration: { kind: "turnEnd" },
};

/** The events that tell the story, in order: trigger and modifier events, markers and points spent. */
const story = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    switch (e.kind) {
      case "triggerSet":
      case "triggerFired":
      case "triggerEnded":
        return [[e.kind, e.source, e.hook].join(":")];
      case "modifierStarted":
      case "modifierEnded":
        return [[e.kind, e.source].join(":")];
      case "marker":
        return [e.value === undefined ? e.label : [e.label, String(e.value)].join(":")];
      case "pointsSpent":
        return [["points", e.side, e.amount].join(":")];
      default:
        return [];
    }
  });

/** A game of `turns` turns and `plays` plays opened with l1 and s1, so LIO's first play is open. */
const atPlay = (rs: Ruleset, extra: { lio?: string[]; sae?: string[] } = {}, turns = 2, plays = 2): GameState =>
  openWith(startGame(turns, plays, rs, setupPlus(extra, turns, plays)), "l1", "s1", rs).state;
const play = (s: GameState, side: Side, card: string, as: PlayUse, rs: Ruleset) =>
  applied(s, playAnswer(s, side, card, as), rs);
const playRival = (s: GameState, side: Side, card: string, order: "before" | "after", rs: Ruleset) => {
  const waiting = play(s, side, card, "points", rs).state;
  return applied(waiting, orderAnswer(waiting, side, order), rs);
};

/** l2's event sets a cardPlayed trigger whose reaction shows the bound card and player. */
const REACTION = [marker("card", "card"), marker("player", "player")];
const REACT = trigger("cardPlayed", REACTION);

describe("the cardPlayed hook", () => {
  it("sets the trigger without firing it for the card that set it, then fires it once for each later play", () => {
    const rs = withCards(sideCard("l2", 1, [REACT]), sideCard("s2", 3, [marker("s2-event")]), sideCard("l3", 2));
    const set = play(atPlay(rs), "lio", "l2", "event", rs);
    expect(story(set.events)).toEqual(["triggerSet:l2:cardPlayed"]);
    expect(set.state.public.triggers).toEqual([
      // LIO played l2 for its event, so the trigger records LIO as its player (#117).
      { source: "l2", hook: "cardPlayed", do: REACTION, expires: { kind: "turnEnd", turn: 1 }, player: "lio" },
    ]);
    const sae = play(set.state, "sae", "s2", "event", rs);
    expect(story(sae.events)).toEqual(["s2-event", "triggerFired:l2:cardPlayed", "card:s2", "player:sae"]);
    expect(sae.state.public.discard.at(-1)).toBe("s2");
    const lio = play(sae.state, "lio", "l3", "points", rs);
    expect(story(lio.events)).toEqual(["points:lio:2", "triggerFired:l2:cardPlayed", "card:l3", "player:lio"]);
  });

  it.each([
    ["after", ["points:sae:3", "l9-event"]],
    ["before", ["l9-event", "points:sae:3"]],
  ] as const)(
    "a rival's card played with its event %s the points fires it after both (owner's decision, question 1)",
    (order, resolved) => {
      const rs = withCards(sideCard("l2", 1, [REACT]), sideCard("l9", 3, [marker("l9-event")]));
      const set = play(atPlay(rs, { sae: ["l9"] }), "lio", "l2", "event", rs).state;
      const sae = playRival(set, "sae", "l9", order, rs);
      expect(story(sae.events)).toEqual([...resolved, "triggerFired:l2:cardPlayed", "card:l9", "player:sae"]);
      expect(sae.state.public.discard.at(-1)).toBe("l9");
    },
  );

  it("opening cards never fire it, even the one revealed after the card that set it (owner's decision, question 2)", () => {
    const rs = withCards(sideCard("l1", 3, [REACT]), sideCard("s1", 1, [marker("s1-event")]), sideCard("l2", 1));
    const opened = openWith(startGame(2, 2, rs, setupPlus({}, 2, 2)), "l1", "s1", rs);
    expect(story(opened.events)).toEqual(["triggerSet:l1:cardPlayed", "s1-event"]);
    // The opening card's trigger still waits for the plays.
    const lio = play(opened.state, "lio", "l2", "points", rs);
    expect(story(lio.events)).toEqual(["points:lio:1", "triggerFired:l1:cardPlayed", "card:l2", "player:lio"]);
  });

  it("a reaction with a yes/no choice asks the side it names, and the played card is discarded after the answer", () => {
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", [choose("ok", "sae"), marker("ok", "ok")])]));
    const set = play(atPlay(rs), "lio", "l2", "event", rs).state;
    const paused = play(set, "sae", "s2", "points", rs).state;
    expect(paused.public.pending).toMatchObject([{ side: "sae", kind: "yesNo" }]);
    expect(paused.public.inPlay).toEqual(["s2"]);
    expect(paused.public.discard).not.toContain("s2");
    const done = answerYesNo(paused, true, rs, "sae");
    expect(story(done.events)).toEqual(["ok:true"]);
    expect(done.state.public.inPlay).toEqual([]);
    expect(done.state.public.discard.at(-1)).toBe("s2");
    expect(done.state.public.pending).toMatchObject([{ side: "lio", kind: "playCardAs" }]);
  });
});

describe("the turnEnd hook", () => {
  const endTrigger = trigger("turnEnd", [marker("end", "turn")]);

  it("fires after the turn's last play, before the modifiers end and the next turn starts", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod, endTrigger]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, 2, 1), "lio", "l2", "event", rs).state;
    const end = play(set, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual(["points:sae:2", "triggerFired:l2:turnEnd", "end:1", "modifierEnded:l2"]);
    expect(end.state.public).toMatchObject({ turn: 2, triggers: [], modifiers: [], turnEndFired: false });
  });

  it("on the last turn, fires before the game is over", () => {
    const rs = withCards(sideCard("l2", 1, [opsMod, endTrigger]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, 1, 1), "lio", "l2", "event", rs).state;
    const end = play(set, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual(["points:sae:2", "triggerFired:l2:turnEnd", "end:1", "modifierEnded:l2"]);
    expect(end.state.public.status.kind).toBe("over");
    expect(end.state.public.triggers).toEqual([]);
  });

  it.each([
    [2, "the next turn starts"],
    [1, "the game ends"],
  ])("a reaction with a yes/no choice pauses after the last play; the answer ends the turn (%i turns: %s)", (turns) => {
    const asks = trigger("turnEnd", [choose("ok", "lio"), marker("ok", "ok")]);
    const rs = withCards(sideCard("l2", 1, [opsMod, asks]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, turns, 1), "lio", "l2", "event", rs).state;
    const paused = play(set, "sae", "s2", "points", rs);
    expect(story(paused.events)).toEqual(["points:sae:2", "triggerFired:l2:turnEnd"]);
    expect(paused.state.public).toMatchObject({ turn: 1, turnEndFired: true, triggers: [] });
    expect(paused.state.public.pending).toMatchObject([{ side: "lio", kind: "yesNo" }]);
    const done = answerYesNo(paused.state, false, rs, "lio");
    expect(story(done.events)).toEqual(["ok:false", "modifierEnded:l2"]);
    if (turns === 1) {
      expect(done.state.public.status.kind).toBe("over");
    } else {
      expect(done.state.public).toMatchObject({ turn: 2, turnEndFired: false });
      expect(done.state.public.pending.map((d) => d.kind)).toEqual(["chooseCard", "chooseCard"]);
    }
  });

  it("a reaction that makes a modifier gives it the trigger's card as its source, and it ends in the same turn end", () => {
    const rs = withCards(sideCard("l2", 1, [trigger("turnEnd", [opsMod])]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, 2, 1), "lio", "l2", "event", rs).state;
    const end = play(set, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual([
      "points:sae:3",
      "triggerFired:l2:turnEnd",
      "modifierStarted:l2",
      "modifierEnded:l2",
    ]);
    expect(end.state.public.modifiers).toEqual([]);
  });
});

describe("several triggers", () => {
  it("fire in the order they were set, at both hooks", () => {
    const rs = withCards(
      sideCard("l2", 1, [trigger("cardPlayed", [marker("first")]), trigger("turnEnd", [marker("first-end")])]),
      sideCard("s2", 1, [trigger("cardPlayed", [marker("second")]), trigger("turnEnd", [marker("second-end")])]),
    );
    const set = play(play(atPlay(rs), "lio", "l2", "event", rs).state, "sae", "s2", "event", rs).state;
    const lio = play(set, "lio", "l3", "points", rs);
    expect(story(lio.events)).toEqual([
      "points:lio:1",
      "triggerFired:l2:cardPlayed",
      "triggerFired:s2:cardPlayed",
      "first",
      "second",
    ]);
    const end = play(lio.state, "sae", "s3", "points", rs);
    expect(story(end.events)).toEqual([
      "points:sae:1",
      "triggerFired:l2:cardPlayed",
      "triggerFired:s2:cardPlayed",
      "first",
      "second",
      "triggerFired:l2:turnEnd",
      "triggerFired:s2:turnEnd",
      "first-end",
      "second-end",
      "triggerEnded:l2:cardPlayed",
      "triggerEnded:s2:cardPlayed",
    ]);
  });
});

describe("a trigger's finite bound and end", () => {
  it("a turnEnd reaction that sets another turnEnd trigger does not loop: the new one does not fire, and expires", () => {
    const nested = trigger("turnEnd", [marker("outer"), trigger("turnEnd", [marker("inner")])]);
    const rs = withCards(sideCard("l2", 1, [nested]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, 2, 1), "lio", "l2", "event", rs).state;
    const end = play(set, "sae", "s2", "points", rs);
    expect(story(end.events)).toEqual([
      "points:sae:3",
      "triggerFired:l2:turnEnd",
      "outer",
      "triggerSet:l2:turnEnd",
      "triggerEnded:l2:turnEnd",
    ]);
    expect(end.state.public).toMatchObject({ turn: 2, triggers: [] });
  });

  it("a trigger set on turn 1 ends with the turn, triggerEnded, and does not fire on turn 2", () => {
    const rs = withCards(sideCard("l2", 1, [REACT]), sideCard("s2", 3));
    const set = play(atPlay(rs, {}, 2, 1), "lio", "l2", "event", rs).state;
    const end = play(set, "sae", "s2", "points", rs);
    expect(story(end.events).slice(-1)).toEqual(["triggerEnded:l2:cardPlayed"]);
    expect(end.state.public.triggers).toEqual([]);
    const opened = openWith(end.state, "l3", "s3", rs).state;
    const lio = play(opened, "lio", "l4", "points", rs);
    expect(story(lio.events)).toEqual(["points:lio:1"]);
  });

  it("the step budget stops a reaction that would run more steps than the ruleset's limit", () => {
    const many = Array.from({ length: 100 }, (_, i) => `x${i}`);
    const rs = withCards(sideCard("l2", 1, [trigger("cardPlayed", [forEach(many, "i", [marker("m")])])]));
    const limited: Ruleset = { ...rs, limits: { stepBudget: 50 } };
    const set = play(atPlay(limited), "lio", "l2", "event", limited).state;
    const r = apply(limited, set, playAnswer(set, "sae", "s2", "points"));
    expect(r).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
  });
});

describe("triggers are public", () => {
  it("every viewer's view shows the waiting triggers and the turnEnd flag", () => {
    const rs = withCards(sideCard("l2", 1, [REACT]));
    const s = play(atPlay(rs), "lio", "l2", "event", rs).state;
    expect(s.public.triggers).toHaveLength(1);
    for (const viewer of ["lio", "sae", "spectator", "omniscient"] as const) {
      expect(viewFor(s, viewer).public.triggers).toEqual(s.public.triggers);
      expect(viewFor(s, viewer).public.turnEndFired).toBe(false);
    }
  });
});

describe("apply with a trigger", () => {
  it("never changes deep-frozen inputs when a trigger fires", () => {
    const rs = deepFreeze(withCards(sideCard("l2", 1, [REACT])));
    const s = deepFreeze(play(atPlay(rs), "lio", "l2", "event", rs).state);
    const before = JSON.stringify(s);
    const r = apply(rs, s, playAnswer(s, "sae", "s2", "points"));
    expect(r.ok && story(r.value.events)).toContain("triggerFired:l2:cardPlayed");
    expect(JSON.stringify(s)).toBe(before);
  });

  it("a trigger step in a program no card started is invalidProgram; with a card, that card is its source", () => {
    const step = trigger("turnEnd", [marker("m")]);
    expect(startProgram(withCards(), startAtPlay(), [step])).toMatchObject({
      ok: false,
      error: { code: "invalidProgram" },
    });
    const r = startProgram(withCards(), startAtPlay(), [step], "z1");
    expect(r.ok && r.value.state.public.triggers.map((t) => t.source)).toEqual(["z1"]);
  });
});
