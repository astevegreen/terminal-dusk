// discardFromHand picks made by a side (#192): with `chosenBy`, the hand's owner or the card's player picks the
// discarded cards in a discardCards decision, instead of the seeded generator.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { copyJson } from "./copy.ts";
import { legalAnswers } from "./decisions.ts";
import { newBudget, resumeStack, startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { applied, cardAnswer, choose, ruleset, sideCard, startAtPlay, withCards } from "./test/game.ts";
import type { Answer, CardId, GameEvent, GameState, Side, Step } from "./types.ts";

type ChosenBy = "owner" | "player";
const discardBy = (side: Side, count: number, chosenBy: ChosenBy): Step => ({
  op: "discardFromHand",
  side,
  count,
  chosenBy,
});
const discardEvents = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "cardsDiscarded");
const revealEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "handRevealed" || e.kind === "handRevealedHidden");

/** Starts `steps` at LIO's first play (or on `state`), as a card played by `player`; expects it to be accepted. */
function started(steps: Step[], player?: Side, state: GameState = startAtPlay()) {
  const r = startProgram(ruleset, state, steps, player === undefined ? undefined : "n1", player);
  if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
  return r.value;
}
/** The answer discarding `cards` to `side`'s open discardCards decision. */
function discardAnswer(state: GameState, side: Side, cards: CardId[]): Answer {
  const d = state.public.pending.find((x) => x.side === side && x.kind === "discardCards");
  if (!d) throw new Error(`no discardCards decision pending for ${side}`);
  return { decisionId: d.id, side, value: { kind: "discardCards", cards } };
}

describe("discardFromHand with chosenBy pauses on a discardCards decision", () => {
  it('"owner": the hand\'s owner picks from its own hand; options say "hand" and the count, never card IDs', () => {
    const before = startAtPlay();
    const { state, events } = started([discardBy("sae", 2, "owner")], "lio", before);
    expect(state.public.pending).toEqual([
      { id: `d${state.meta.seq}`, side: "sae", kind: "discardCards", options: { from: "hand", count: 2 } },
    ]);
    expect(state.private.sae.hand).toEqual(before.private.sae.hand);
    expect(state.secret.rng).toEqual(before.secret.rng);
    expect(revealEvents(events)).toEqual([]);
    expect(discardEvents(events)).toEqual([]);
  });

  it('"player" not the owner: the hand is shown to the player first, who picks from "rivalHand"', () => {
    const before = startAtPlay();
    const hand = before.private.sae.hand;
    const { state, events } = started([discardBy("sae", 2, "player")], "lio", before);
    expect(state.public.pending).toEqual([
      { id: `d${state.meta.seq}`, side: "lio", kind: "discardCards", options: { from: "rivalHand", count: 2 } },
    ]);
    expect(revealEvents(events)).toEqual([
      {
        kind: "handRevealed",
        visibility: "lio",
        side: "sae",
        cards: hand,
        publicForm: { kind: "handRevealedHidden", visibility: "public", side: "sae", cards: hand.length },
      },
    ]);
    expect(state.private.lio.knowledge).toEqual(hand);
    expect(state.secret.rng).toEqual(before.secret.rng);
  });

  it('"player" who is the owner behaves as "owner": from "hand", no reveal', () => {
    const { state, events } = started([discardBy("sae", 1, "player")], "sae");
    expect(state.public.pending).toMatchObject([
      { side: "sae", kind: "discardCards", options: { from: "hand", count: 1 } },
    ]);
    expect(revealEvents(events)).toEqual([]);
    expect(state.private.lio.knowledge).toEqual([]);
  });

  it('"player" in a program with no recorded player returns invalidProgram', () => {
    const r = startProgram(ruleset, startAtPlay(), [discardBy("sae", 1, "player")]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });

  it.each<[ChosenBy, number]>([
    ["owner", 4],
    ["player", 4],
    ["owner", 9],
    ["player", 9],
  ])("%s with count %i: a hand of count cards or fewer goes whole, with no decision, reveal or draw", (by, count) => {
    const before = startAtPlay();
    const hand = before.private.sae.hand;
    expect(hand).toHaveLength(4);
    const { state, events } = started([discardBy("sae", count, by), { op: "marker", label: "after" }], "lio", before);
    expect(state.private.sae.hand).toEqual([]);
    expect(state.public.discard).toEqual([...before.public.discard, ...hand]);
    expect(state.secret.rng).toEqual(before.secret.rng);
    expect(state.public.pending.some((d) => d.kind === "discardCards")).toBe(false);
    expect(revealEvents(events)).toEqual([]);
    expect(discardEvents(events)).toEqual([{ kind: "cardsDiscarded", visibility: "public", side: "sae", cards: hand }]);
  });

  it.each<ChosenBy>(["owner", "player"])(
    "%s: an empty hand discards nothing and emits cardsDiscarded with no cards",
    (by) => {
      const base = copyJson(startAtPlay());
      base.private.sae.hand = [];
      const { state, events } = started([discardBy("sae", 1, by)], "lio", base);
      expect(state.public.discard).toEqual(base.public.discard);
      expect(state.secret.rng).toEqual(base.secret.rng);
      expect(discardEvents(events)).toEqual([{ kind: "cardsDiscarded", visibility: "public", side: "sae", cards: [] }]);
    },
  );
});

describe("legal discardCards answers", () => {
  it("lists every set of count different cards from the hand, each in hand order, sets in order of hand position", () => {
    const { state } = started([discardBy("sae", 2, "player")], "lio");
    const [a, b, c, d] = state.private.sae.hand;
    const sets = [
      [a, b],
      [a, c],
      [a, d],
      [b, c],
      [b, d],
      [c, d],
    ];
    expect(legalAnswers(ruleset, state, "lio")).toEqual(sets.map((cards) => ({ kind: "discardCards", cards })));
    expect(legalAnswers(ruleset, state, "sae")).toEqual([]);
  });

  it("an owner's pick lists sets from its own hand", () => {
    const { state } = started([discardBy("sae", 3, "owner")], "lio");
    const [a, b, c, d] = state.private.sae.hand;
    expect(legalAnswers(ruleset, state, "sae").map((v) => ("cards" in v ? v.cards : []))).toEqual([
      [a, b, c],
      [a, b, d],
      [a, c, d],
      [b, c, d],
    ]);
  });

  it("refuses too few or too many cards, a card not in that hand, a repeated card and cards out of hand order", () => {
    const { state } = started([discardBy("sae", 2, "player")], "lio");
    const frozen = deepFreeze(state);
    const json = JSON.stringify(frozen);
    const [a, b] = state.private.sae.hand;
    const lioCard = state.private.lio.hand[0]!;
    for (const cards of [[a!], [a!, b!, state.private.sae.hand[2]!], [a!, lioCard], [a!, a!], [b!, a!], []]) {
      expect(apply(ruleset, frozen, discardAnswer(frozen, "lio", cards))).toMatchObject({
        ok: false,
        error: { code: "illegalAnswer" },
      });
    }
    expect(JSON.stringify(frozen)).toBe(json);
  });

  it("an answer from the other side is wrongSide", () => {
    const { state } = started([discardBy("sae", 2, "player")], "lio");
    const answer = discardAnswer(state, "lio", state.private.sae.hand.slice(0, 2));
    expect(apply(ruleset, state, { ...answer, side: "sae" })).toMatchObject({
      ok: false,
      error: { code: "wrongSide" },
    });
  });
});

describe("the answer resumes the paused discardFromHand step", () => {
  it.each<[ChosenBy, Side]>([
    ["player", "lio"],
    ["owner", "sae"],
  ])(
    "%s: the chosen cards go to the discard pile in hand order, one cardsDiscarded, and the program runs on",
    (by, picker) => {
      const before = startAtPlay();
      const paused = started([discardBy("sae", 2, by), { op: "marker", label: "after" }], "lio", before).state;
      const [a, b, c, d] = paused.private.sae.hand;
      const { state, events } = applied(paused, discardAnswer(paused, picker, [b!, d!]));
      expect(state.private.sae.hand).toEqual([a, c]);
      expect(state.public.discard).toEqual([...paused.public.discard, b, d]);
      expect(discardEvents(events)).toEqual([
        { kind: "cardsDiscarded", visibility: "public", side: "sae", cards: [b, d] },
      ]);
      expect(events.filter((e) => e.kind === "marker").map((e) => (e.kind === "marker" ? e.label : ""))).toEqual([
        "after",
      ]);
      expect(state.public.stack).toEqual([]);
      expect(state.secret.rng).toEqual(before.secret.rng);
    },
  );

  it("the discarded cards leave the picker's knowledge; the cards kept stay known", () => {
    const paused = started([discardBy("sae", 2, "player")], "lio").state;
    const [a, b, c, d] = paused.private.sae.hand;
    const { state } = applied(paused, discardAnswer(paused, "lio", [a!, c!]));
    expect(state.private.lio.knowledge).toEqual([b, d]);
  });

  it("a played card's event: its player picks from the rival's hand, then the game moves on to the next play", () => {
    const rs = withCards(sideCard("l2", 1, [discardBy("sae", 1, "player")]));
    const before = startAtPlay();
    const paused = applied(before, cardAnswer(before, "lio", "l2", rs), rs).state;
    expect(paused.public.pending).toMatchObject([
      { side: "lio", kind: "discardCards", options: { from: "rivalHand" } },
    ]);
    const target = paused.private.sae.hand[1]!;
    const { state } = applied(paused, discardAnswer(paused, "lio", [target]), rs);
    expect(state.private.sae.hand).not.toContain(target);
    expect(state.public.discard).toContain(target);
    expect(state.public.pending).toMatchObject([{ side: "sae", kind: "playCardAs" }]);
  });

  it("never mutates its input: the pausing call and the answering call both work on frozen states", () => {
    const frozen = deepFreeze(startAtPlay());
    const json = JSON.stringify(frozen);
    const r = startProgram(ruleset, frozen, [discardBy("sae", 2, "player")], "n1", "lio");
    expect(r.ok).toBe(true);
    expect(JSON.stringify(frozen)).toBe(json);
    if (!r.ok) return;
    const paused = deepFreeze(r.value.state);
    const pausedJson = JSON.stringify(paused);
    const answered = apply(ruleset, paused, discardAnswer(paused, "lio", paused.private.sae.hand.slice(0, 2)));
    expect(answered.ok).toBe(true);
    expect(JSON.stringify(paused)).toBe(pausedJson);
  });
});

describe("resumeStack accepts a discardCards answer only at a discardFromHand step with chosenBy", () => {
  const closing = (cards: CardId[]) => ({ who: "lio" as const, value: { kind: "discardCards" as const, cards } });

  it("at a paused yes/no choice it is invalidProgram", () => {
    const s = copyJson(started([choose("go")], "lio").state);
    expect(resumeStack(s, closing([]), [], newBudget(ruleset))).toMatchObject({ code: "invalidProgram" });
  });

  it("at a discardFromHand step without chosenBy it is invalidProgram", () => {
    const s = copyJson(started([discardBy("sae", 2, "player")], "lio").state);
    const frame = s.public.stack.at(-1)!;
    frame.steps[frame.next] = { op: "discardFromHand", side: "sae", count: 2 };
    const cards = s.private.sae.hand.slice(0, 2);
    expect(resumeStack(s, closing(cards), [], newBudget(ruleset))).toMatchObject({ code: "invalidProgram" });
  });

  it("with an empty stack it is invalidProgram", () => {
    const s = copyJson(startAtPlay());
    expect(resumeStack(s, closing([]), [], newBudget(ruleset))).toMatchObject({ code: "invalidProgram" });
  });

  it("a yes/no answer at a paused discardFromHand step is invalidProgram", () => {
    const s = copyJson(started([discardBy("sae", 2, "player")], "lio").state);
    const yes = { who: "lio" as const, value: { kind: "yesNo" as const, yes: true } };
    expect(resumeStack(s, yes, [], newBudget(ruleset))).toMatchObject({ code: "invalidProgram" });
  });
});
