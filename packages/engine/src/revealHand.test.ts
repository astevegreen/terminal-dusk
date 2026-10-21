// The revealHand step (#184): shows one side's hand to the other, kept in the peeking side's knowledge.
import { describe, expect, it } from "vitest";
import { copyJson } from "./copy.ts";
import { eventsFor } from "./events.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { accepted, cardAnswer, startAtPlay, startGame, startWith } from "./test/game.ts";
import { ruleset } from "./test/game.ts";
import { hiddenPart, reconstruct, viewFor } from "./views.ts";
import { SIDES, otherSide } from "./types.ts";
import type { GameEvent, GameState, Side, Step } from "./types.ts";

const reveal = (side: Side): Step => ({ op: "revealHand", side });
const revealEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "handRevealed" || e.kind === "handRevealedHidden");

/** LIO's first play, with SAE's hand shown to LIO. */
const saeShown = (): GameState => startWith([reveal("sae")]).state;

describe("knowledge in a new game", () => {
  it("createGame starts both sides with empty knowledge", () => {
    const s = startGame();
    expect(s.private.lio.knowledge).toEqual([]);
    expect(s.private.sae.knowledge).toEqual([]);
  });
});

describe("the revealHand step", () => {
  it.each(SIDES)("shows %s's whole hand to the other side, in hand order, and leaves the shown hand alone", (side) => {
    const before = startAtPlay();
    const { state } = startWith([reveal(side)], ruleset, before);
    const peeker = otherSide(side);
    expect(state.private[side].hand).toEqual(before.private[side].hand);
    expect(state.private[peeker].knowledge).toEqual(before.private[side].hand);
    expect(state.private[side].knowledge).toEqual([]);
  });

  it("emits handRevealed for the peeking side, with the cards in hand order and a public form with only the count", () => {
    const before = startAtPlay();
    const hand = before.private.sae.hand;
    const { events } = startWith([reveal("sae")], ruleset, before);
    expect(revealEvents(events)).toEqual([
      {
        kind: "handRevealed",
        visibility: "lio",
        side: "sae",
        cards: hand,
        publicForm: { kind: "handRevealedHidden", visibility: "public", side: "sae", cards: hand.length },
      },
    ]);
  });

  it("eventsFor gives the peeking side the full event, and the shown side and spectators only the public form", () => {
    const { events } = startWith([reveal("sae")], ruleset, startAtPlay());
    expect(revealEvents(eventsFor(events, "lio")).map((e) => e.kind)).toEqual(["handRevealed"]);
    for (const viewer of ["sae", "spectator"] as const) {
      const seen = revealEvents(eventsFor(events, viewer));
      expect(seen).toEqual([{ kind: "handRevealedHidden", visibility: "public", side: "sae", cards: 4 }]);
    }
  });

  it("keeps cards already known in their place, adds new ones at the end, and lists each once", () => {
    const base = copyJson(startAtPlay());
    const hand = base.private.sae.hand;
    base.private.lio.knowledge = [hand[2]!];
    const { state } = startWith([reveal("sae"), reveal("sae")], ruleset, base);
    expect(state.private.lio.knowledge).toEqual([hand[2], hand[0], hand[1], ...hand.slice(3)]);
  });

  it("an empty hand changes nothing in knowledge but still emits the event", () => {
    const base = copyJson(startAtPlay());
    base.private.sae.hand = [];
    base.private.lio.knowledge = [];
    const { state, events } = startWith([reveal("sae")], ruleset, base);
    expect(state.private.lio.knowledge).toEqual([]);
    expect(revealEvents(events)).toEqual([
      {
        kind: "handRevealed",
        visibility: "lio",
        side: "sae",
        cards: [],
        publicForm: { kind: "handRevealedHidden", visibility: "public", side: "sae", cards: 0 },
      },
    ]);
  });

  it("never mutates its input: a reveal on a frozen state works and leaves it unchanged", () => {
    const frozen = deepFreeze(startAtPlay());
    const json = JSON.stringify(frozen);
    const r = startProgram(ruleset, frozen, [reveal("sae")]);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(frozen)).toBe(json);
    if (r.ok) expect(JSON.parse(JSON.stringify(r.value.state))).toStrictEqual(r.value.state);
  });
});

describe("a card leaves knowledge when it leaves the rival's hand", () => {
  it("(a) a shown card is played and is then gone from knowledge; the rest keep their order", () => {
    const shown = saeShown();
    const known = shown.private.lio.knowledge;
    const afterLio = accepted(shown, cardAnswer(shown, "lio"));
    expect(afterLio.private.lio.knowledge).toEqual(known);
    const played = known[1]!;
    const afterSae = accepted(afterLio, cardAnswer(afterLio, "sae", played));
    expect(afterSae.private.sae.hand).not.toContain(played);
    expect(afterSae.private.lio.knowledge).toEqual(known.filter((c) => c !== played));
  });

  it("(b) a shown secret opening pick stays known while only one side has answered, and leaves once both have", () => {
    // Turn 1: SAE's hand is shown to LIO, then both play. Turn 2 opens on the secret pick.
    const shown = saeShown();
    const afterLio = accepted(shown, cardAnswer(shown, "lio"));
    const atOpening = accepted(afterLio, cardAnswer(afterLio, "sae"));
    expect(atOpening.public.turn).toBe(2);
    const known = atOpening.private.lio.knowledge;
    const picked = known[0]!;
    expect(atOpening.private.sae.hand).toContain(picked);

    const half = accepted(atOpening, cardAnswer(atOpening, "sae", picked));
    expect(half.private.lio.knowledge).toEqual(known);
    expect(viewFor(half, "lio").mine).toEqual(viewFor(atOpening, "lio").mine);

    const both = accepted(half, cardAnswer(half, "lio"));
    expect(both.private.sae.hand).not.toContain(picked);
    expect(both.private.lio.knowledge).toEqual(known.filter((c) => c !== picked));
  });
});

describe("views after a reveal", () => {
  it("the peeking side's view shows its knowledge; the shown side's and the spectator's never carry it", () => {
    const s = saeShown();
    const known = s.private.lio.knowledge;
    expect(known.length).toBeGreaterThan(0);
    expect(viewFor(s, "lio").mine?.knowledge).toEqual(known);
    expect(viewFor(s, "sae").mine?.knowledge).toEqual([]);
    expect(viewFor(s, "spectator").mine).toBeNull();
    expect(JSON.stringify(viewFor(s, "spectator"))).not.toContain("knowledge");
    // SAE sees its own hand, which holds the same cards, but never LIO's knowledge of them.
    expect(JSON.stringify(viewFor(s, "sae"))).not.toContain(`"knowledge":${JSON.stringify(known)}`);
  });

  it("hiddenPart for the shown side carries the peeker's knowledge, so reconstruct rebuilds the state for both sides", () => {
    const s = deepFreeze(saeShown());
    expect(hiddenPart(s, "sae").opponent.knowledge).toEqual(s.private.lio.knowledge);
    for (const side of SIDES) {
      const rebuilt = reconstruct(viewFor(s, side), hiddenPart(s, side));
      expect(rebuilt).toStrictEqual(s);
      expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(s));
    }
  });
});
