// A new era (#37): the setup's checks, its cards waiting in secret, and the shuffle into the draw pile only.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { copyJson } from "./copy.ts";
import { createGame } from "./createGame.ts";
import { legalAnswers } from "./decisions.ts";
import { enterEra } from "./eras.ts";
import { eventsFor } from "./events.ts";
import { seedHash } from "./sha256.ts";
import { hiddenPart, reconstruct, viewFor } from "./views.ts";
import { makeSetup, playAnswers, ruleset, rulesetWith } from "./test/game.ts";
import type { EraEntry, GameEvent, GameState, Setup } from "./types.ts";

/** The test ruleset plus e1-e8, neutral cards for the eras. */
const ERA_CARDS = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"];
/** e1-e4 belong to era2, e5-e8 to era3: a card listed under an era must say it is from that era. */
const eraOf = (id: string) => (Number(id.slice(1)) <= 4 ? "era2" : "era3");
const base = rulesetWith([...ruleset.cards.map((card) => card.id), ...ERA_CARDS]);
const rs = {
  ...base,
  cards: base.cards.map((card) => (ERA_CARDS.includes(card.id) ? { ...card, era: eraOf(card.id) } : card)),
};

/** makeSetup over `turns` turns, with `eras`. */
const withEras = (eras: EraEntry[], turns = 3): Setup => ({ ...makeSetup(turns), eras });
const ERA_2: EraEntry = { era: "era2", turn: 2, cards: ["e1", "e2", "e3", "e4"] };

function start(setup: Setup, seed = "seed-1"): { state: GameState; events: GameEvent[] } {
  const r = createGame(rs, { ...setup, seedHash: seedHash(seed) }, seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code} ${r.error.message ?? ""}`);
  return r.value;
}

/** The setup's error code, or "ok". */
const codeFor = (setup: Setup): string => {
  const r = createGame(rs, setup, "seed-1");
  return r.ok ? "ok" : r.error.code;
};

/** Turn 1 takes 4 answers (two opening picks, one play each); the 4th opens turn 2, where era2 enters. */
const TURN_1 = 4;
/** The state just before the answer that opens turn 2, and that answer's state and events. */
function intoTurn2(setup: Setup, seed = "seed-1") {
  const before = playAnswers(start(setup, seed).state, TURN_1 - 1, rs);
  const d = before.public.pending[0]!;
  const r = apply(rs, before, { decisionId: d.id, side: d.side, value: legalAnswers(rs, before, d.side)[0]! });
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return { before, after: r.value.state, events: r.value.events };
}

describe("createGame checks the setup's eras", () => {
  it("accepts eras on different turns from 2 to the last turn", () => {
    const later: EraEntry = { era: "era3", turn: 3, cards: ["e5"] };
    expect(codeFor(withEras([ERA_2, later]))).toBe("ok");
  });
  it("rejects two eras entering on the same turn", () => {
    expect(codeFor(withEras([ERA_2, { era: "era3", turn: 2, cards: ["e5"] }]))).toBe("invalidSetup");
  });
  it("rejects an era entering on turn 0", () => {
    expect(codeFor(withEras([{ ...ERA_2, turn: 0 }]))).toBe("invalidSetup");
  });
  it("rejects an era entering on turn 1", () => {
    expect(codeFor(withEras([{ ...ERA_2, turn: 1 }]))).toBe("invalidSetup");
  });
  it("rejects an era entering on the turn after the last", () => {
    expect(codeFor(withEras([{ ...ERA_2, turn: 4 }], 3))).toBe("invalidSetup");
  });
  it("rejects an era entering on a turn that is not a whole number", () => {
    expect(codeFor(withEras([{ ...ERA_2, turn: 2.5 }]))).toBe("invalidSetup");
  });
  it("rejects an era with no cards", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: [] }]))).toBe("invalidSetup");
  });
  it("rejects an era card that is not in the ruleset", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: ["e1", "nope"] }]))).toBe("invalidSetup");
  });
  it("rejects the same card twice in one era's list", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: ["e1", "e2", "e1"] }]))).toBe("invalidSetup");
  });
  it("rejects an era card already in the draw pile", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: ["e1", "z1"] }]))).toBe("invalidSetup");
  });
  it("rejects an era card already in a hand", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: ["e1", "n1"] }]))).toBe("invalidSetup");
  });
  it("rejects an era card that belongs to a different era than the one it is listed under", () => {
    expect(codeFor(withEras([{ ...ERA_2, cards: ["e1", "e5"] }]))).toBe("invalidSetup");
  });
  it("says which card and which eras clash", () => {
    const r = createGame(rs, withEras([{ ...ERA_2, cards: ["e1", "e5"] }]), "seed-1");
    expect(!r.ok && r.error.message).toMatch(/e5.*era3.*era2/);
  });
  it("rejects an era card already in another era", () => {
    expect(codeFor(withEras([ERA_2, { era: "era3", turn: 3, cards: ["e5", "e2"] }]))).toBe("invalidSetup");
  });
  it("rejects eras that are not a list, and an entry without a list of cards or an era name", () => {
    const bad = (eras: unknown) => codeFor({ ...makeSetup(3), eras } as Setup);
    expect(bad("era2")).toBe("invalidSetup");
    expect(bad([{ era: "era2", turn: 2 }])).toBe("invalidSetup");
    expect(bad([{ turn: 2, cards: ["e1"] }])).toBe("invalidSetup");
  });
  it("still accepts a setup with no eras at all", () => {
    expect(codeFor(makeSetup(3))).toBe("ok");
  });
});

describe("an era's cards wait in secret until its turn", () => {
  it("keeps them in secret.eras, in the setup's order, out of the draw pile", () => {
    const { state } = start(withEras([ERA_2]));
    expect(state.secret.eras).toEqual([ERA_2]);
    expect(state.secret.deck.filter((card) => ERA_CARDS.includes(card))).toEqual([]);
  });
  it("no view shows them, and hiddenPart carries them", () => {
    const { state } = start(withEras([ERA_2]));
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      const text = JSON.stringify(viewFor(state, viewer));
      for (const card of ERA_2.cards) expect(text).not.toContain(JSON.stringify(card));
    }
    expect(hiddenPart(state, "lio").secret.eras).toEqual([ERA_2]);
  });
  it("reconstruct rebuilds the state before, as and after the era enters", () => {
    const setup = withEras([ERA_2]);
    const first = start(setup).state;
    const { before, after } = intoTurn2(setup);
    const later = playAnswers(after, 2, rs);
    for (const state of [first, before, after, later]) {
      for (const side of ["lio", "sae"] as const) {
        expect(reconstruct(viewFor(state, side), hiddenPart(state, side))).toEqual(state);
      }
    }
  });
});

describe("at the start of the era's turn", () => {
  it("shuffles the era's cards into the draw pile before the opening picks, and no longer holds them in secret", () => {
    const { before, after } = intoTurn2(withEras([ERA_2]));
    expect(before.public.turn).toBe(1);
    expect(after.public.turn).toBe(2);
    expect(after.secret.eras).toEqual([]);
    expect(after.public.pending.map((d) => d.kind)).toEqual(["chooseCard", "chooseCard"]);
    expect(after.secret.deck).toHaveLength(before.secret.deck.length + ERA_2.cards.length);
  });
  it("leaves the discard pile identical", () => {
    // Turn 1 is over: its four cards are in the discard pile. Then the era's step runs on its own.
    const state = copyJson(playAnswers(start(withEras([ERA_2])).state, TURN_1, rs));
    state.public.turn = 2;
    state.secret.eras = [ERA_2];
    const discard = [...state.public.discard];
    expect(discard).toHaveLength(4);
    enterEra(state, []);
    expect(state.public.discard).toEqual(discard);
  });
  it("the discard pile is the same with and without the era", () => {
    const withEra = intoTurn2(withEras([ERA_2])).after;
    const withoutEra = intoTurn2(makeSetup(3)).after;
    expect(withEra.public.discard).toEqual(withoutEra.public.discard);
  });
  it("the new draw pile holds exactly the old draw pile plus the era's cards, each once", () => {
    const { before, after } = intoTurn2(withEras([ERA_2]));
    expect([...after.secret.deck].sort()).toEqual([...before.secret.deck, ...ERA_2.cards].sort());
  });
  it("the same seed gives the same order, and different seeds give different orders", () => {
    const orderFor = (seed: string) => intoTurn2(withEras([ERA_2]), seed).after.secret.deck.join(",");
    expect(orderFor("seed-1")).toBe(orderFor("seed-1"));
    const orders = new Set(Array.from({ length: 20 }, (_, i) => orderFor(`seed-${i + 1}`)));
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });
  it("an era on a later turn waits until that turn", () => {
    const era3: EraEntry = { era: "era3", turn: 3, cards: ["e5", "e6"] };
    const { after } = intoTurn2(withEras([era3, ERA_2]));
    expect(after.secret.eras).toEqual([era3]);
    const turn3 = playAnswers(after, TURN_1, rs);
    expect(turn3.public.turn).toBe(3);
    expect(turn3.secret.eras).toEqual([]);
    expect(turn3.secret.deck.filter((card) => ERA_CARDS.includes(card)).sort()).toEqual(
      [...ERA_2.cards, ...era3.cards].sort(),
    );
  });
});

describe("the eraStarted event", () => {
  it("is public and gives the era and the number of cards added, with no card IDs", () => {
    const { events } = intoTurn2(withEras([ERA_2]));
    const started = events.filter((e) => e.kind === "eraStarted");
    expect(started).toEqual([{ kind: "eraStarted", visibility: "public", era: "era2", cardsAdded: 4 }]);
  });
  it("no era card appears in any event, for either side or a spectator, or in any view", () => {
    const { after, events } = intoTurn2(withEras([ERA_2]));
    const texts = [
      JSON.stringify(events.filter((e) => e.visibility === "public")),
      ...(["lio", "sae", "spectator"] as const).flatMap((viewer) => [
        JSON.stringify(eventsFor(events, viewer)),
        JSON.stringify(viewFor(after, viewer)),
      ]),
    ];
    for (const text of texts) {
      for (const card of ERA_2.cards) expect(text).not.toContain(JSON.stringify(card));
    }
  });
});
