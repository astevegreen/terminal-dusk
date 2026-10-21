// A removeAfterEvent card leaves the game when its event happens (#199; owner, 21 Oct): played for its event,
// picked as an opening card, or played by the rival for its points (its event still runs). It goes to the
// public `removed` pile instead of the discard pile, and never comes back. Played for its points with no
// event (its own side's card, or a neutral card), it is discarded like any other card.
import { describe, expect, it } from "vitest";
import { apply, createGame, hiddenPart, legalAnswers, reconstruct, seedHash, viewFor } from "./index.ts";
import type { CardDef, CardId, GameEvent, GameState, Ruleset, Setup, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  applied,
  choose,
  openWith,
  orderAnswer,
  playAnswer,
  rulesetWith,
  setupPlus,
  sideCard,
  startGame,
  withCards,
} from "./test/game.ts";

/** The test card `id` (affiliation from its id), flagged removeAfterEvent. */
const flagged = (id: CardId, ops = 1, effect: Step[] = []): CardDef => ({
  ...sideCard(id, ops, effect),
  flags: { removeAfterEvent: true },
});

/** Where `card` is now: "removed", "discard", "inPlay", "hand", "deck", or "nowhere". */
function placeOf(s: GameState, card: CardId): string {
  if (s.public.removed.includes(card)) return "removed";
  if (s.public.discard.includes(card)) return "discard";
  if (s.public.inPlay.includes(card)) return "inPlay";
  if (s.private.lio.hand.includes(card) || s.private.sae.hand.includes(card)) return "hand";
  return s.secret.deck.includes(card) ? "deck" : "nowhere";
}

/** The game at LIO's first play, after the opening picks l1 and s1. */
const atLioPlay = (rs: Ruleset, setup?: Setup): GameState => openWith(startGame(2, 1, rs, setup), "l1", "s1", rs).state;

describe("a new game", () => {
  it("starts with an empty removed pile", () => {
    expect(startGame().public.removed).toEqual([]);
  });
});

describe("a flagged card whose event ran goes to removed", () => {
  it.each([
    ["its own card for its event", "l2"],
    ["a neutral card for its event", "n1"],
  ])("LIO plays %s", (_case, card) => {
    const rs = withCards(flagged(card));
    const s = atLioPlay(rs);
    const after = applied(s, playAnswer(s, "lio", card, "event"), rs).state;
    expect(after.public.removed).toEqual([card]);
    expect(after.public.discard).not.toContain(card);
  });

  it("an opening pick of the picker's own card", () => {
    const rs = withCards(flagged("l1"));
    const opened = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;
    expect(opened.public.removed).toEqual(["l1"]);
    expect(opened.public.discard).toEqual(["s1"]);
  });

  it("an opening pick of a rival's card", () => {
    const rs = withCards(flagged("l9"));
    const opened = openWith(startGame(2, 1, rs, setupPlus({ sae: ["l9"] })), "l1", "l9", rs).state;
    expect(opened.public.removed).toEqual(["l9"]);
    expect(opened.public.discard).toEqual(["l1"]);
  });

  it.each(["before", "after"] as const)(
    "a rival's card played for its points, with its event %s the points",
    (event) => {
      const rs = withCards(flagged("l9"));
      const s = atLioPlay(rs, setupPlus({ sae: ["l9"] }));
      const lioPlayed = applied(s, playAnswer(s, "lio", "l2", "points"), rs).state;
      const waiting = applied(lioPlayed, playAnswer(lioPlayed, "sae", "l9", "points"), rs).state;
      const done = applied(waiting, orderAnswer(waiting, "sae", event), rs).state;
      expect(done.public.removed).toEqual(["l9"]);
      expect(done.public.discard).not.toContain("l9");
    },
  );
});

describe("a flagged card played for its points with no event goes to the discard pile", () => {
  it.each([
    ["its own card for its points", "l2"],
    ["a neutral card for its points", "n1"],
  ])("LIO plays %s", (_case, card) => {
    const rs = withCards(flagged(card));
    const s = atLioPlay(rs);
    const after = applied(s, playAnswer(s, "lio", card, "points"), rs).state;
    expect(after.public.discard.at(-1)).toBe(card);
    expect(after.public.removed).toEqual([]);
  });
});

describe("a flagged card with cardPlayed reactions still pending", () => {
  it("leaves for removed only once the reactions finish", () => {
    // LIO's n1 sets a cardPlayed trigger that pauses on a choose, so SAE's s2 stays in play until it is answered.
    const pauseOnPlay: Step = { op: "trigger", hook: "cardPlayed", do: [choose("go")], duration: { kind: "turnEnd" } };
    const rs = withCards(sideCard("n1", 1, [pauseOnPlay]), flagged("s2"));
    const s = atLioPlay(rs);
    const lioPlayed = applied(s, playAnswer(s, "lio", "n1", "event"), rs).state;
    const paused = applied(lioPlayed, playAnswer(lioPlayed, "sae", "s2", "event"), rs).state;
    expect(paused.public.inPlay).toEqual(["s2"]);
    expect(paused.public.removed).toEqual([]);
    const done = answerYesNo(paused, true, rs).state;
    expect(done.public.removed).toEqual(["s2"]);
    expect(done.public.inPlay).toEqual([]);
  });
});

describe("a removed card never comes back", () => {
  // LIO is dealt the flagged l1 and l2, SAE s1 and s2, with n1 to draw, and era2's e1 enters on turn 2. Every
  // turn both hands empty, so turn 2's refill draws n1 and e1, then reshuffles the discards.
  const base = rulesetWith(["l1", "l2", "s1", "s2", "n1", "e1"]);
  const rs: Ruleset = {
    ...base,
    cards: base.cards.map((c) => {
      if (c.id === "l1") return { ...c, flags: { removeAfterEvent: true } };
      return c.id === "e1" ? { ...c, era: "era2" } : c;
    }),
  };
  const setup: Setup = {
    seedHash: seedHash("seed-1"),
    hands: { lio: ["l1", "l2"], sae: ["s1", "s2"] },
    deck: ["n1"],
    turns: 3,
    playsPerTurn: 1,
    handSize: 2,
    eras: [{ era: "era2", turn: 2, cards: ["e1"] }],
    contingency: { lio: [1, 2, 3], sae: [1, 2, 3], world: [1, 2, 3] },
  };

  it("stays in removed, in no hand, draw pile or discard pile, after a reshuffle, a new era and on the last turn", () => {
    const created = createGame(rs, setup, "seed-1");
    if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
    let s = openWith(created.value.state, "l1", "s1", rs).state;
    expect(s.public.removed).toEqual(["l1"]);
    const events: GameEvent[] = [];
    let lastTurnSeen = false;
    while (s.public.status.kind === "active") {
      const d = s.public.pending[0];
      if (!d) throw new Error("no decision pending");
      const r = applied(s, { decisionId: d.id, side: d.side, value: legalAnswers(rs, s, d.side)[0]! }, rs);
      events.push(...r.events);
      s = r.state;
      if (s.public.turn === 3) lastTurnSeen = true;
      expect(s.public.removed).toEqual(["l1"]);
      expect(placeOf(s, "l1")).toBe("removed");
    }
    expect(lastTurnSeen).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["drawPileReshuffled", "eraStarted"]));
  });
});

describe("the removed pile is public", () => {
  const rs = withCards(flagged("l1"));
  const opened = openWith(startGame(2, 1, rs), "l1", "s1", rs).state;

  it("LIO, SAE and a spectator all see it", () => {
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(viewFor(opened, viewer).public.removed).toEqual(["l1"]);
    }
  });

  it("a side's view and its hidden part rebuild the state, removed pile included", () => {
    for (const side of ["lio", "sae"] as const) {
      expect(reconstruct(viewFor(opened, side), hiddenPart(opened, side))).toStrictEqual(opened);
    }
  });
});

describe("apply never changes its input when a card is removed", () => {
  it("a frozen state and answer still give the removal", () => {
    const rs = withCards(flagged("l2"));
    const s = deepFreeze(atLioPlay(rs));
    const r = apply(rs, s, deepFreeze(playAnswer(s, "lio", "l2", "event")));
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    expect(r.value.state.public.removed).toEqual(["l2"]);
    expect(s.public.removed).toEqual([]);
  });
});
