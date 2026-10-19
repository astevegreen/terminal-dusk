// Playing a card for its event or its points, and the rival-card rules (#36).
import { describe, expect, it } from "vitest";
import { apply, legalAnswers, pendingFor } from "./index.ts";
import type { GameEvent, GameState, Ruleset } from "./index.ts";
import {
  applied,
  asks,
  choose,
  marker,
  openWith,
  orderAnswer,
  playAnswer,
  ruleset,
  setupPlus,
  sideCard,
  startGame,
  withCards,
  yesNoAnswer,
} from "./test/game.ts";

/** What happened, in order: markers as "label:value", spent points as "points:side:amount". */
const story = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    if (e.kind === "marker") return [`${e.label}:${String(e.value)}`];
    if (e.kind === "pointsSpent") return [`points:${e.side}:${e.amount}`];
    return [];
  });

/** A 2-turn, 1-play game opened with l1 and s1 (no events), so LIO's play is open. */
const atLioPlay = (rs: Ruleset, extra: { lio?: string[]; sae?: string[] } = {}): GameState =>
  openWith(startGame(2, 1, rs, setupPlus(extra)), "l1", "s1", rs).state;

/** As atLioPlay, then LIO plays l2 for its points, so SAE's play is open. */
const atSaePlay = (rs: Ruleset, extra: { lio?: string[]; sae?: string[] } = {}): GameState => {
  const s = atLioPlay(rs, extra);
  return applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
};

describe("the playCardAs decision", () => {
  it("replaces the placeholder play: its options describe the rule, never the cards in hand", () => {
    const s = atLioPlay(ruleset);
    expect(s.public.pending).toEqual([
      {
        id: expect.any(String),
        side: "lio",
        kind: "playCardAs",
        options: { from: "hand", uses: { own: ["event", "points"], rival: ["points"], neutral: ["event", "points"] } },
      },
    ]);
    for (const id of s.private.lio.hand) expect(JSON.stringify(s.public.pending)).not.toContain(`"${id}"`);
  });
  it("legalAnswers lists that side's cards in hand order: own event or points, rival points, neutral event or points", () => {
    const s = atLioPlay(ruleset, { lio: ["s9"] });
    expect(s.private.lio.hand).toEqual(["l2", "l3", "l4", "n1", "s9"]);
    const uses = legalAnswers(ruleset, s, "lio").map((v) => (v.kind === "playCardAs" ? `${v.card} ${v.as}` : "?"));
    expect(uses).toEqual([
      "l2 event",
      "l2 points",
      "l3 event",
      "l3 points",
      "l4 event",
      "l4 points",
      "n1 event",
      "n1 points",
      "s9 points",
    ]);
  });
  it("answering event with a rival's card is an illegalAnswer and changes nothing", () => {
    const s = atLioPlay(ruleset, { lio: ["s9"] });
    const before = JSON.stringify(s);
    expect(apply(ruleset, s, playAnswer(s, "lio", "s9", "event"))).toMatchObject({
      ok: false,
      error: { code: "illegalAnswer" },
    });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("where a played card is: in play until everything it triggered has finished", () => {
  it.each(["before", "after"] as const)(
    "SAE plays an LIO card for points whose event has a choice, with the event %s the points",
    (order) => {
      const rs = withCards(sideCard("l9", 3, asks("lio", "event")));
      const s = atSaePlay(rs, { sae: ["l9"] });
      const discardBefore = s.public.discard;

      const waitingOrder = applied(s, playAnswer(s, "sae", "l9", "points"), rs).state;
      expect(waitingOrder.private.sae.hand).not.toContain("l9");
      expect(waitingOrder.public.inPlay).toEqual(["l9"]);
      expect(waitingOrder.public.discard).toEqual(discardBefore);
      expect(waitingOrder.public.pending).toMatchObject([{ side: "sae", kind: "rivalEventOrder" }]);

      const waitingChoice = applied(waitingOrder, orderAnswer(waitingOrder, "sae", order), rs);
      expect(waitingChoice.state.public.inPlay).toEqual(["l9"]);
      expect(waitingChoice.state.public.discard).toEqual(discardBefore);
      expect(waitingChoice.state.public.pending).toMatchObject([{ side: "lio", kind: "yesNo" }]);

      const done = applied(waitingChoice.state, yesNoAnswer(waitingChoice.state, true), rs);
      expect(done.state.public.inPlay).toEqual([]);
      expect(done.state.public.discard).toEqual([...discardBefore, "l9"]);
      // The play is over, and it was the turn's last, so the next turn opens.
      expect(done.state.public.pending.map((d) => d.kind)).toEqual(["chooseCard", "chooseCard"]);
      expect(story([...waitingChoice.events, ...done.events])).toEqual(
        order === "before" ? ["event:true", "points:sae:3"] : ["points:sae:3", "event:true"],
      );
    },
  );
});

describe("your own card", () => {
  it("for its event: its effect steps run, and you answer their choices", () => {
    const rs = withCards(sideCard("l2", 2, asks("lio", "event")));
    const s = atLioPlay(rs);
    const paused = applied(s, playAnswer(s, "lio", "l2", "event"), rs);
    expect(paused.events).toEqual([]);
    expect(paused.state.public.pending).toMatchObject([{ side: "lio", kind: "yesNo" }]);
    const done = applied(paused.state, yesNoAnswer(paused.state, false), rs);
    expect(story(done.events)).toEqual(["event:false"]);
    expect(done.state.public.discard.at(-1)).toBe("l2");
    expect(done.state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });
  it("for its points: spendPoints runs and its event does not", () => {
    const rs = withCards(sideCard("l2", 2, [marker("never")]));
    const s = atLioPlay(rs);
    const r = applied(s, playAnswer(s, "lio", "l2", "points"), rs);
    expect(r.events).toEqual([{ kind: "pointsSpent", visibility: "public", side: "lio", amount: 2 }]);
    expect(r.state.public.discard.at(-1)).toBe("l2");
    expect(r.state.public.inPlay).toEqual([]);
    expect(r.state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });
});

describe("a rival's card, for its points", () => {
  it("the player first answers rivalEventOrder, whose legal answers are before and after", () => {
    const rs = withCards(sideCard("l9", 3, [marker("event")]));
    const s = atSaePlay(rs, { sae: ["l9"] });
    const r = applied(s, playAnswer(s, "sae", "l9", "points"), rs);
    expect(r.events).toEqual([]);
    expect(r.state.public.pending).toEqual([
      { id: expect.any(String), side: "sae", kind: "rivalEventOrder", options: {} },
    ]);
    expect(legalAnswers(rs, r.state, "sae")).toEqual([
      { kind: "rivalEventOrder", event: "before" },
      { kind: "rivalEventOrder", event: "after" },
    ]);
    expect(legalAnswers(rs, r.state, "lio")).toEqual([]);
  });
  it.each([
    ["before", ["event:undefined", "points:lio:4"]],
    ["after", ["points:lio:4", "event:undefined"]],
  ] as const)("the event runs %s spendPoints", (order, expected) => {
    const rs = withCards(sideCard("s9", 4, [marker("event")]));
    const s = atLioPlay(rs, { lio: ["s9"] });
    const waiting = applied(s, playAnswer(s, "lio", "s9", "points"), rs).state;
    const r = applied(waiting, orderAnswer(waiting, "lio", order), rs);
    expect(story(r.events)).toEqual(expected);
    expect(r.state.public.discard.at(-1)).toBe("s9");
    expect(r.state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });
  it("each choice in its event goes to the side its choose step names, never to whoever played the card", () => {
    const rs = withCards(sideCard("l9", 3, [choose("a", "lio"), choose("b", "sae")]));
    const s = atSaePlay(rs, { sae: ["l9"] });
    const waiting = applied(s, playAnswer(s, "sae", "l9", "points"), rs).state;
    const first = applied(waiting, orderAnswer(waiting, "sae", "before"), rs).state;
    expect(pendingFor(first, "lio")).toMatchObject({ kind: "yesNo" });
    expect(pendingFor(first, "sae")).toBeNull();
    const second = applied(first, yesNoAnswer(first, true, "lio"), rs).state;
    expect(pendingFor(second, "sae")).toMatchObject({ kind: "yesNo" });
    expect(pendingFor(second, "lio")).toBeNull();
  });
});

describe("a neutral card, for its event", () => {
  it("its event runs and no points are spent", () => {
    const rs = withCards(sideCard("n1", 3, [marker("n1-event")]));
    const s = atLioPlay(rs);
    const r = applied(s, playAnswer(s, "lio", "n1", "event"), rs);
    expect(story(r.events)).toEqual(["n1-event:undefined"]);
    expect(r.state.public.discard.at(-1)).toBe("n1");
    expect(r.state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });
  it.each([
    ["LIO plays a neutral card whose choice is SAE's", "lio", "n1", "sae"],
    ["LIO plays a neutral card whose choice is LIO's", "lio", "n1", "lio"],
    ["SAE plays a neutral card whose choice is LIO's", "sae", "n2", "lio"],
  ] as const)("%s", (_case, player, id, chooser) => {
    const rs = withCards(sideCard(id, 2, asks(chooser, "event")));
    const s = player === "lio" ? atLioPlay(rs) : atSaePlay(rs);
    const paused = applied(s, playAnswer(s, player, id, "event"), rs).state;
    expect(paused.public.inPlay).toEqual([id]);
    expect(pendingFor(paused, chooser)).toMatchObject({ kind: "yesNo" });
    const done = applied(paused, yesNoAnswer(paused, true, chooser), rs);
    expect(story(done.events)).toEqual(["event:true"]);
    expect(done.state.public.discard.at(-1)).toBe(id);
  });
});

describe("a neutral card, for its points", () => {
  it("spendPoints runs and no event happens (core-loop.md: a neutral card played for points has no event)", () => {
    const rs = withCards(sideCard("n1", 3, [marker("never")]));
    const s = atLioPlay(rs);
    const r = applied(s, playAnswer(s, "lio", "n1", "points"), rs);
    expect(r.events).toEqual([{ kind: "pointsSpent", visibility: "public", side: "lio", amount: 3 }]);
    expect(r.state.public.discard.at(-1)).toBe("n1");
    expect(r.state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });
});
