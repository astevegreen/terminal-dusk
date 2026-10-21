// The discardFromHand step (#186): a side discards cards from its hand, chosen at random with the seeded
// generator, to the discard pile and without their events.
import { describe, expect, it } from "vitest";
import { copyJson } from "./copy.ts";
import { eventsFor } from "./events.ts";
import { nextInt } from "./rng.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { applied, cardAnswer, markers, marker, ruleset, sideCard, startAtPlay, startWith } from "./test/game.ts";
import { withCards } from "./test/game.ts";
import { hiddenPart, reconstruct, viewFor } from "./views.ts";
import { SIDES } from "./types.ts";
import type { CardId, GameEvent, GameState, Side, Step } from "./types.ts";

const discard = (side: Side, count: number): Step => ({ op: "discardFromHand", side, count });
const discardEvents = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "cardsDiscarded");

/** The cards `count` random picks take from `hand`, one nextInt each over the cards left, in hand order. */
function expectedPicks(state: GameState, hand: readonly CardId[], count: number) {
  const left = [...hand];
  const picked = new Set<CardId>();
  let rng = state.secret.rng;
  for (let i = 0; i < count; i++) {
    const drawn = nextInt(rng, left.length);
    rng = drawn.state;
    picked.add(left.splice(drawn.value, 1)[0]!);
  }
  return { discarded: hand.filter((c) => picked.has(c)), kept: hand.filter((c) => !picked.has(c)), rng };
}

describe("the discardFromHand step", () => {
  it.each(SIDES)(
    "%s discards count cards picked with one nextInt each from secret.rng, which keeps the new state",
    (side) => {
      const before = startAtPlay();
      const hand = before.private[side].hand;
      expect(hand.length).toBeGreaterThan(2);
      const want = expectedPicks(before, hand, 2);
      const { state, events } = startWith([discard(side, 2)], ruleset, before);
      expect(state.private[side].hand).toEqual(want.kept);
      expect(state.public.discard).toEqual([...before.public.discard, ...want.discarded]);
      expect(state.secret.rng).toEqual(want.rng);
      expect(discardEvents(events)).toEqual([
        { kind: "cardsDiscarded", visibility: "public", side, cards: want.discarded },
      ]);
    },
  );

  it("the same seed and moves always discard the same cards", () => {
    const first = startWith([discard("sae", 2)]);
    const second = startWith([discard("sae", 2)]);
    expect(second.state.private.sae.hand).toEqual(first.state.private.sae.hand);
    expect(second.state.public.discard).toEqual(first.state.public.discard);
    expect(second.events).toEqual(first.events);
  });

  it.each([4, 9])(
    "a hand of count cards or fewer (count %i) is discarded whole, with no draw from the generator",
    (count) => {
      const before = startAtPlay();
      const hand = before.private.sae.hand;
      expect(hand).toHaveLength(4);
      const { state, events } = startWith([discard("sae", count)], ruleset, before);
      expect(state.private.sae.hand).toEqual([]);
      expect(state.public.discard).toEqual([...before.public.discard, ...hand]);
      expect(state.secret.rng).toEqual(before.secret.rng);
      expect(discardEvents(events)).toEqual([
        { kind: "cardsDiscarded", visibility: "public", side: "sae", cards: hand },
      ]);
    },
  );

  it("an empty hand discards nothing, leaves secret.rng unchanged, and still emits the event with no cards", () => {
    const base = copyJson(startAtPlay());
    base.private.sae.hand = [];
    const { state, events } = startWith([discard("sae", 1)], ruleset, base);
    expect(state.public.discard).toEqual(base.public.discard);
    expect(state.secret.rng).toEqual(base.secret.rng);
    expect(discardEvents(events)).toEqual([{ kind: "cardsDiscarded", visibility: "public", side: "sae", cards: [] }]);
  });

  it("eventsFor gives every viewer the same public event", () => {
    const { events } = startWith([discard("sae", 2)]);
    const all = discardEvents(events);
    expect(all).toHaveLength(1);
    for (const viewer of ["lio", "sae", "spectator"] as const)
      expect(discardEvents(eventsFor(events, viewer))).toEqual(all);
  });

  it("never mutates its input: a discard on a frozen state works and leaves it unchanged; the result is plain JSON", () => {
    const frozen = deepFreeze(startAtPlay());
    const json = JSON.stringify(frozen);
    const r = startProgram(ruleset, frozen, [discard("sae", 2)]);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(frozen)).toBe(json);
    if (!r.ok) return;
    expect(JSON.parse(JSON.stringify(r.value.state))).toStrictEqual(r.value.state);
    for (const n of r.value.state.secret.rng) expect(Number.isInteger(n)).toBe(true);
  });
});

describe("discarded cards' events do not happen", () => {
  // SAE's cards each hold a marker; LIO's l2 sets a cardPlayed trigger, then makes SAE discard 2 cards.
  const reacts: Step = { op: "trigger", hook: "cardPlayed", do: [marker("reacted")], duration: { kind: "turnEnd" } };
  const rs = withCards(
    sideCard("l2", 1, [reacts, discard("sae", 2)]),
    ...["s1", "s2", "s3", "s4", "n2"].map((id) => sideCard(id, 1, [marker(`boom-${id}`)])),
  );

  it("a discarded card holding a marker shows no marker, never enters inPlay, and fires no cardPlayed trigger", () => {
    const before = startAtPlay();
    const { state, events } = applied(before, cardAnswer(before, "lio", "l2", rs), rs);
    const [shown] = discardEvents(events);
    expect(shown?.cards).toHaveLength(2);
    expect(markers(events)).toEqual([]);
    expect(events.filter((e) => e.kind === "triggerFired")).toEqual([]);
    for (const card of shown!.cards) {
      expect(state.public.inPlay).not.toContain(card);
      expect(state.public.discard).toContain(card);
    }
  });
});

describe("knowledge and views after a discard", () => {
  it("a discarded card leaves the rival's knowledge; the known cards not discarded keep their order", () => {
    const { state, events } = startWith([{ op: "revealHand", side: "sae" }, discard("sae", 2)]);
    const [shown] = discardEvents(events);
    const known = state.private.lio.knowledge;
    expect(shown?.cards).toHaveLength(2);
    expect(known).toEqual(state.private.sae.hand);
    for (const card of known) expect(state.private.sae.hand).toContain(card);
  });

  it("reconstruct(viewFor(s, x), hiddenPart(s, x)) still equals s for both sides, and the rival's hand count drops", () => {
    const before = startAtPlay();
    const s = deepFreeze(startWith([discard("sae", 2)], ruleset, before).state);
    for (const side of SIDES) expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toStrictEqual(s);
    expect(viewFor(s, "lio").counts.hands.sae).toBe(viewFor(before, "lio").counts.hands.sae - 2);
  });
});
